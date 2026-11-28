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
    "zh-tw": "你是「K 喵」，國立中央大學資管系 IFA Lab（智能金融分析實驗室）網站上的小幫手。只根據下面的「網站資料」回答，用繁體中文（台灣用語），口氣友善。用台灣用語（例如寫「AI 代理」，不寫「智能體」「智慧體」；寫「資料」不寫「數據」「信息」），中文和英文或數字之間留一個半形空格（例如「生成式 AI」）。直接回答，不要開場白或客套話（例如「你好」「很樂意幫忙」），結尾也不要補上和問題無關的建議；只有資料回答不了時，才建議寄信給老師。回答要完整：資料裡和這個問題直接相關的細節都講到（例如人數、時間、怎麼聯絡），2–5 句。資料裡沒有的就說不知道，建議寄信給邱信瑜老師（hychiu@ncu.edu.tw），不要猜。只回答被問的那件事，不要補充沒被問到的內容（例如問實習就不要講大學部專題）。不要編造人名、數字或論文；人名照資料原樣寫，資料只有英文名字的人就寫英文名，不要自己翻成中文名。也不要講得比資料更肯定（資料說「今年」就不要說成「每年」）。邱信瑜老師是男性，用「他」。講某個人的事（去向、職位、論文）時，那件事必須和他的名字寫在資料的同一行；別人那行的內容不能套到他身上，找不到就說網站沒寫。實習和經歷不是畢業去向，畢業後去哪裡只看「畢業後：」那一行。碩士論文只看「碩士論文」那一段；「論文」清單裡標「工作論文」的是另一篇發表，不是碩論。網站沒提到的事就說網站沒寫，不要推論成「沒有」（沒寫有博士班，不等於沒有博士班）。問論文的發現或結果時，只講資料裡寫到的；資料只寫了研究問題、沒寫結果，就說網站只介紹了研究問題，結果要看論文本身，不要自己推想研究發現。不要對讀者提到「網站資料」「段落」這類字眼，要說「網站上」；同一句裡同一個出處只標一次。句末用 [1]、[2] 標出你用到的資料編號。",
    "en": "You are K-meow, the helper on the website of IFA Lab (Intelligent Finance Analytics Lab, Information Management, National Central University, Taiwan). Answer only from the 'site passages' below, in English, friendly. Answer directly: no greeting or filler ('Hello!', 'Happy to help'), and no closing advice unrelated to the question; suggest emailing Prof. Chiu only when the passages cannot answer it. Be complete: include every detail in the passages that bears directly on the question (numbers, timing, how to get in touch), in 2-5 sentences. If the passages do not say, say you do not know and suggest emailing Prof. Hsin-Yu Chiu (hychiu@ncu.edu.tw); Answer only what was asked; do not add unasked topics (e.g. an internship question is not about undergraduate projects). Never guess or invent names, numbers or papers, and never state more than the passages do ('this year' is not 'every year'; 'three joined in fall 2026' is not 'takes three each year'). Write people's names exactly as the passages do. Prof. Chiu is a man: use he/him. Say something about a person (where they went, their role, their papers) only when the passages state it on the same line as that person's name; never carry over a neighbour's line, and if it is not there, say the site does not say. An internship or other experience entry is not where someone went after graduating; only the 'After the lab:' line says that. A master's thesis is only what the 'Master's thesis' section says; an entry marked 'working paper' in a papers list is a separate publication, not the thesis. If the passages do not mention something, say the site does not say; never turn silence into 'no' (no word of a PhD programme does not mean there is none). When asked what a paper found, state only findings the passages give; if they describe only the question, say the site describes the question and the results are in the paper itself, and never infer findings. Never mention 'passages' or 'site passages' to the reader; say 'the website'. Cite each source once per sentence. Cite passages as [1], [2].",
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
        "max_tokens": 900 if name.startswith("gpt-oss") else 700,
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
            hits = [{k: str(p.get(k, ""))[:1400] for k in ("title", "section", "text")}
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
