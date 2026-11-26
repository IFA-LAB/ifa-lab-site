// The site's Worker: serves the static build, plus POST /api/ask for the "問 K 喵" assistant.
// Retrieval runs here, over dist/ask-corpus.json (the site's own text, built with the pages), so answers always
// match what is deployed. The question and the best passages go to the lab's DGX Spark (ifa-ask-proxy → tunnel),
// which writes the answer with a local model. If the Spark is busy, asleep or unreachable, the reply still carries
// the matching passages and links, so a visitor always gets something useful.

interface Passage { id: number; lang: 'zh-tw' | 'en'; url: string; title: string; section: string; text: string }
interface Env {
  ASSETS: { fetch: typeof fetch };
  ASK?: { fetch: typeof fetch };
  ASK_LIMIT?: { limit: (o: { key: string }) => Promise<{ success: boolean }> };
}

type Index = { ps: Passage[]; docs: Map<string, number>[]; lens: number[]; df: Map<string, number>; avg: number };
let cached: Promise<Index> | null = null;

/** Latin words plus CJK characters and character bigrams. */
function grams(s: string): string[] {
  s = s.toLowerCase();
  const out: string[] = [...(s.match(/[a-z0-9][a-z0-9.+#-]*/g) ?? [])];
  for (const run of s.match(/[㐀-鿿]+/g) ?? []) {
    const cs = [...run];
    out.push(...cs);
    for (let i = 0; i < cs.length - 1; i++) out.push(cs[i] + cs[i + 1]);
  }
  return out;
}
const count = (ts: string[]) => { const m = new Map<string, number>(); for (const t of ts) m.set(t, (m.get(t) ?? 0) + 1); return m; };

async function loadIndex(env: Env, origin: string): Promise<Index> {
  const r = await env.ASSETS.fetch(new Request(`${origin}/ask-corpus.json`));
  const ps = (await r.json()) as Passage[];
  const docs = ps.map((p) => count(grams(`${p.section} ${p.text}`)));
  const lens = docs.map((d) => [...d.values()].reduce((a, b) => a + b, 0));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  return { ps, docs, lens, df, avg: lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length) };
}

/** BM25 over the passages, preferring the visitor's language; one passage per page section. */
function search(ix: Index, q: string, lang: string, k = 5): Passage[] {
  const qs = count(grams(q));
  const scored: [number, number][] = [];
  ix.docs.forEach((d, i) => {
    let s = 0;
    for (const t of qs.keys()) {
      const f = d.get(t);
      if (!f) continue;
      const n = ix.df.get(t) ?? 0;
      const idf = Math.log(1 + (ix.ps.length - n + 0.5) / (n + 0.5));
      s += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * ix.lens[i]) / ix.avg));
    }
    if (s > 0) scored.push([ix.ps[i].lang === lang ? s : s * 0.5, i]);
  });
  scored.sort((a, b) => b[0] - a[0]);
  const out: Passage[] = [], seen = new Set<string>();
  for (const [, i] of scored) {
    const p = ix.ps[i];
    if (p.lang !== lang || seen.has(p.url + p.section)) continue;
    seen.add(p.url + p.section);
    out.push(p);
    if (out.length >= k) break;
  }
  return out;
}

const json = (o: unknown, status = 200) => Response.json(o, { status, headers: { 'Cache-Control': 'no-store' } });

async function ask(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const origin = new URL(req.url).origin;
  if (req.headers.get('Origin') && req.headers.get('Origin') !== origin) return json({ error: 'forbidden' }, 403);
  const ip = req.headers.get('CF-Connecting-IP') ?? 'anon';
  if (env.ASK_LIMIT && !(await env.ASK_LIMIT.limit({ key: ip })).success) return json({ error: 'slow down', mode: 'limited' }, 429);
  let q = '', lang = 'zh-tw';
  try {
    const b = (await req.json()) as { q?: unknown; lang?: unknown };
    q = String(b.q ?? '').trim().slice(0, 400);
    lang = b.lang === 'en' ? 'en' : 'zh-tw';
  } catch { return json({ error: 'bad request' }, 400); }
  if (q.length < 2) return json({ error: 'empty question' }, 400);

  cached ??= loadIndex(env, origin).catch((e) => { cached = null; throw e; });
  const hits = search(await cached, q, lang);
  const sources = hits.map((p) => ({ title: p.section || p.title, url: p.url, text: p.text.slice(0, 220) }));
  if (!env.ASK) return json({ answer: '', mode: 'search', sources });
  try {
    const r = await env.ASK.fetch('https://ask/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, lang, passages: hits.map(({ title, section, text }) => ({ title, section, text })) }),
    });
    const a = (await r.json()) as { answer?: string; mode?: string; model?: string };
    return json({ answer: a.answer ?? '', mode: a.answer ? 'llm' : a.mode === 'warming' ? 'warming' : 'search', sources });
  } catch {
    return json({ answer: '', mode: 'search', sources });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/ask') return ask(req, env);
    return env.ASSETS.fetch(req);
  },
};
