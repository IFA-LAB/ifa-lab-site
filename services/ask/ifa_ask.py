#!/usr/bin/python3 -I
"""ifa-ask: the model half of the "問 K 喵" assistant on the IFA Lab website, running on the lab's DGX Spark.

POST /ask  {"q": "...", "lang": "zh-tw" | "en", "passages": [{"title", "section", "text"}]}
           ->  {"answer": str, "mode": "llm" | "warming" | "error", "model"?: str}
GET  /health  ->  {"ok": true, "model": name | null}

The website's Worker does the retrieval (it holds the site's own text) and reaches this service only through a
Cloudflare Tunnel + Workers VPC; it listens on 127.0.0.1. The model is whichever shared lab model is already
running (spark-llm); if none is, it asks spark-llm to start qwen3-30b (refused when memory is busy) and answers
"warming", and the Worker shows the matching passages instead. Standard library only.
"""
import json, os, re, subprocess, time, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("IFA_ASK_PORT", "8790"))
TS = "https://spark-5641.tailb12763.ts.net"
MODELS = [("gpt-oss-120b", f"{TS}:8443"), ("qwen3-30b", f"{TS}:10000")]  # first running one wins
START = "qwen3-30b"
MAX_Q = 400
last_start = 0.0

SYS = {
    "zh-tw": "你是「K 喵」，國立中央大學資管系 IFA Lab（智能金融分析實驗室）網站上的小幫手。只根據下面的「網站資料」回答，用繁體中文（台灣用語），口氣友善、簡短（3–6 句）。資料裡沒有的就說不知道，建議寄信給邱信瑜老師（hychiu@ncu.edu.tw），不要猜。只回答被問的那件事，不要補充沒被問到的內容（例如問實習就不要講大學部專題）。不要編造人名、數字或論文。句末用 [1]、[2] 標出你用到的資料編號。",
    "en": "You are K-Cat, the helper on the website of IFA Lab (Intelligent Finance Analytics Lab, Information Management, National Central University, Taiwan). Answer only from the 'site passages' below, in English, friendly and short (3-6 sentences). If the passages do not say, say you do not know and suggest emailing Prof. Hsin-Yu Chiu (hychiu@ncu.edu.tw); Answer only what was asked; do not add unasked topics (e.g. an internship question is not about undergraduate projects). Never guess or invent names, numbers or papers. Cite passages as [1], [2].",
}


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


def answer(q, lang, hits):
    m = running_model()
    if not m:
        warm()
        return {"answer": "", "mode": "warming"}
    name, base = m
    ctx = "\n\n".join(f"[{i + 1}] {p['title']} › {p['section']}\n{p['text']}" for i, p in enumerate(hits)) or "（沒有找到相關資料）"
    body = {
        "model": name,
        "messages": [
            {"role": "system", "content": SYS[lang] + ("\n\n網站資料：\n" if lang == "zh-tw" else "\n\nSite passages:\n") + ctx},
            {"role": "user", "content": q},
        ],
        "max_tokens": 900 if name.startswith("gpt-oss") else 450,
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
        return {"answer": "", "mode": "error"}
    return {"answer": text, "mode": "llm" if text else "error", "model": name}


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
            return self.send(200, {"ok": True, "model": m[0] if m else None})
        self.send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/ask":
            return self.send(404, {"error": "not found"})
        try:
            n = min(int(self.headers.get("Content-Length", "0")), 32768)
            data = json.loads(self.rfile.read(n) or b"{}")
            q = str(data.get("q", "")).strip()[:MAX_Q]
            lang = "en" if data.get("lang") == "en" else "zh-tw"
            hits = [{k: str(p.get(k, ""))[:900] for k in ("title", "section", "text")}
                    for p in (data.get("passages") or [])[:6] if isinstance(p, dict)]
        except Exception:
            return self.send(400, {"error": "bad request"})
        if len(q) < 2:
            return self.send(400, {"error": "empty question"})
        t = time.time()
        res = answer(q, lang, hits)
        print(f"ask {lang} {res['mode']} {time.time() - t:.1f}s len={len(q)}", flush=True)  # no question text in logs
        self.send(200, res)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
