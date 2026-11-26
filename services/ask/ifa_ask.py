#!/usr/bin/python3 -I
"""ifa-ask: the "問 K 喵" assistant behind the IFA Lab website, running on the lab's DGX Spark.

POST /ask  {"q": "...", "lang": "zh-tw" | "en"}  ->  {"answer": str, "sources": [{"title", "url"}], "mode": "llm" | "search" | "warming"}
GET  /health                                       ->  {"ok": true, "passages": N, "model": name | null}

Only the website's Worker reaches it, through a Cloudflare Tunnel + Workers VPC (it listens on 127.0.0.1).
It answers only from the site's own text (ask-corpus.json, refreshed hourly from the live site) and cites pages.
The model is whichever shared lab model is already running (spark-llm); if none is, it asks spark-llm to start
qwen3-30b (refused when memory is busy) and meanwhile returns the best matching passages instead of an answer.
Standard library only.
"""
import json, math, os, re, subprocess, threading, time, urllib.request
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SITE = os.environ.get("IFA_SITE", "https://ifa-lab.jushenhuang-jason.workers.dev")
PORT = int(os.environ.get("IFA_ASK_PORT", "8790"))
TS = "https://spark-5641.tailb12763.ts.net"
MODELS = [("gpt-oss-120b", f"{TS}:8443"), ("qwen3-30b", f"{TS}:10000")]  # first running one wins
START = "qwen3-30b"
MAX_Q = 400

corpus, index, lock = [], {}, threading.Lock()
last_start = 0.0


def grams(s):
    """Latin words plus CJK character bigrams (and single characters, for one-character words)."""
    s = s.lower()
    out = re.findall(r"[a-z0-9][a-z0-9.+#-]*", s)
    for run in re.findall(r"[㐀-鿿]+", s):
        out += list(run) + [run[i:i + 2] for i in range(len(run) - 1)]
    return out


def build(passages):
    docs = [Counter(grams(p["section"] + " " + p["text"])) for p in passages]
    df = Counter(t for d in docs for t in d)
    avg = sum(sum(d.values()) for d in docs) / max(1, len(docs))
    return {"docs": docs, "df": df, "avg": avg, "n": len(docs)}


def load():
    global corpus, index
    try:
        with urllib.request.urlopen(f"{SITE}/ask-corpus.json", timeout=20) as r:
            data = json.load(r)
        idx = build(data)
        with lock:
            corpus, index = data, idx
        print(f"corpus: {len(data)} passages", flush=True)
    except Exception as e:  # keep the old corpus
        print(f"corpus refresh failed: {e}", flush=True)


def refresher():
    while True:
        time.sleep(3600)
        load()


def search(q, lang, k=6):
    with lock:
        ps, ix = corpus, index
    if not ps:
        return []
    qs = Counter(grams(q))
    scores = []
    for i, d in enumerate(ix["docs"]):
        dl = sum(d.values())
        s = 0.0
        for t, qf in qs.items():
            f = d.get(t)
            if not f:
                continue
            idf = math.log(1 + (ix["n"] - ix["df"][t] + 0.5) / (ix["df"][t] + 0.5))
            s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * dl / ix["avg"]))
        if s > 0:
            scores.append((s * (1.15 if ps[i]["lang"] == lang else 1.0), i))
    scores.sort(reverse=True)
    seen, out = set(), []
    for s, i in scores:
        p = ps[i]
        if p["lang"] != lang and len(out) >= 3:
            continue
        key = (p["url"], p["text"][:60])
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
        if len(out) >= k:
            break
    return out


def running_model():
    for name, base in MODELS:
        try:
            with urllib.request.urlopen(f"{base}/health", timeout=3) as r:
                if r.status == 200:
                    return name, base
        except Exception:
            pass
    return None


def warm():
    """Ask spark-llm to start the smaller shared model; at most once every 5 minutes."""
    global last_start
    if time.time() - last_start < 300:
        return
    last_start = time.time()
    subprocess.Popen(["/usr/local/bin/spark-llm", "start", START], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


SYS = {
    "zh-tw": "你是「K 喵」，國立中央大學資管系 IFA Lab（智能金融分析實驗室）網站上的小幫手。只根據下面的「網站資料」回答，用繁體中文（台灣用語），口氣友善、簡短（3–6 句）。資料裡沒有的就說不知道，建議寄信給邱信瑜老師（hychiu@ncu.edu.tw），不要猜。不要編造人名、數字或論文。句末用 [1]、[2] 標出你用到的資料編號。",
    "en": "You are K-Cat, the helper on the website of IFA Lab (Intelligent Finance Analytics Lab, Information Management, National Central University, Taiwan). Answer only from the 'site passages' below, in English, friendly and short (3-6 sentences). If the passages do not say, say you do not know and suggest emailing Prof. Hsin-Yu Chiu (hychiu@ncu.edu.tw); never guess or invent names, numbers or papers. Cite passages as [1], [2].",
}


def answer(q, lang):
    hits = search(q, lang)
    sources = [{"title": (p["section"] or p["title"])[:80], "url": p["url"]} for p in hits]
    m = running_model()
    if not m:
        warm()
        return {"answer": "", "sources": sources, "mode": "warming" if hits else "search", "passages": [p["text"][:240] for p in hits[:3]]}
    name, base = m
    ctx = "\n\n".join(f"[{i + 1}] {p['title']} › {p['section']}\n{p['text']}" for i, p in enumerate(hits)) or "（沒有找到相關資料）"
    body = {
        "model": name,
        "messages": [
            {"role": "system", "content": SYS[lang] + ("\n\n網站資料：\n" if lang == "zh-tw" else "\n\nSite passages:\n") + ctx},
            {"role": "user", "content": q},
        ],
        "max_tokens": 700 if name.startswith("gpt-oss") else 400,
        "temperature": 0.3,
    }
    req = urllib.request.Request(f"{base}/v1/chat/completions", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            out = json.load(r)
        text = (out["choices"][0]["message"].get("content") or "").strip()
        text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()
    except Exception as e:
        print(f"llm error: {e}", flush=True)
        return {"answer": "", "sources": sources, "mode": "search", "passages": [p["text"][:240] for p in hits[:3]]}
    return {"answer": text, "sources": sources, "mode": "llm", "model": name}


class H(BaseHTTPRequestHandler):
    def send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/health":
            m = running_model()
            return self.send(200, {"ok": True, "passages": len(corpus), "model": m[0] if m else None})
        self.send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/ask":
            return self.send(404, {"error": "not found"})
        try:
            n = min(int(self.headers.get("Content-Length", "0")), 4096)
            data = json.loads(self.rfile.read(n) or b"{}")
            q = str(data.get("q", "")).strip()[:MAX_Q]
            lang = "en" if data.get("lang") == "en" else "zh-tw"
        except Exception:
            return self.send(400, {"error": "bad request"})
        if len(q) < 2:
            return self.send(400, {"error": "empty question"})
        t = time.time()
        res = answer(q, lang)
        print(f"ask {lang} {res['mode']} {time.time() - t:.1f}s len={len(q)}", flush=True)  # no question text in logs
        self.send(200, res)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    load()
    threading.Thread(target=refresher, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
