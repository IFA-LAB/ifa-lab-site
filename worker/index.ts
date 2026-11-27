// The site's Worker: serves the static build, plus POST /api/ask for the "問 K 喵" assistant.
// Retrieval runs here, over dist/ask-corpus.json (the site's own text, built with the pages), so answers always
// match what is deployed. The question and the best passages go to the lab's DGX Spark (ifa-ask-proxy → tunnel),
// which writes the answer with a local model. If the Spark is busy, asleep or unreachable, the reply still carries
// the matching passages and links, so a visitor always gets something useful.

import { SYS } from './prompt';

interface Passage { id: number; lang: 'zh-tw' | 'en'; url: string; title: string; section: string; text: string }
interface Env {
  ASSETS: { fetch: typeof fetch };
  ASK?: { fetch: typeof fetch };
  ASK_LIMIT?: { limit: (o: { key: string }) => Promise<{ success: boolean }> };
  /** Workers AI: answers when the Spark has no model running */
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  /** per-day count of Workers AI answers (key n:YYYY-MM-DD), so the fallback stays inside the free daily allocation */
  ASK_DAY?: { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void> };
}

type Index = { ps: Passage[]; docs: Map<string, number>[]; lens: number[]; df: Map<string, number>; avg: number };
let cached: Promise<Index> | null = null;

// Function words carry no topic. Most passages are Chinese, so English words are rare corpus-wide and even "i" or
// "do" would get a high idf and outrank the word the visitor actually asked about.
const STOP = new Set('a an and are as at be but by can could do does for from had has have how i if in is it its me my of on or our so than that the their them then there these they this to was we were what when where which who why will with would you your'.split(' '));

/** Latin words plus CJK characters and character bigrams. */
function grams(s: string): string[] {
  s = s.toLowerCase();
  // English: drop a plural or -ing/-ed ending so "internship" meets "internships" (a light stemmer is enough here)
  const out: string[] = (s.match(/[a-z0-9][a-z0-9.+#-]*/g) ?? []).filter((w) => !STOP.has(w)).map((w) => (w.length > 4 ? w.replace(/(ies|es|s|ing|ed)$/, (m) => (m === 'ies' ? 'y' : '')) : w));
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
  // the section heading counts three times: it names the topic, while long sections would otherwise drown it
  const docs = ps.map((p) => count(grams(`${p.section} ${p.section} ${p.section} ${p.text}`)));
  const lens = docs.map((d) => [...d.values()].reduce((a, b) => a + b, 0));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  return { ps, docs, lens, df, avg: lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length) };
}

/** BM25 over the passages, preferring the visitor's language; one passage per page section. */
function search(ix: Index, q: string, lang: string, k = 5): Passage[] {
  // short forms people type for the headings the site uses
  const qn = q.replace(/碩論/g, '碩士論文').toLowerCase();
  const qs = count(grams(qn));
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
    // the question names this section's heading (碩士論文, 經歷, thesis…): that section answers it, however long it is
    // (length normalisation had put a 505-character 碩士論文 below a short 論文 list that marks the same work 工作論文)
    const sec = ix.ps[i].section.toLowerCase();
    if (s > 0 && sec.length >= 2 && (qn.includes(sec) || sec.split(/[\s'’]+/).some((w) => w.length >= 5 && qn.includes(w)))) s *= 1.6;
    // the question names a person: their own page comes before other members' sections on the same topic
    const who = ix.ps[i].title.split('｜')[0].toLowerCase();
    if (s > 0 && who.length >= 2 && who !== 'ifa lab' && qn.includes(who)) s *= 1.5;
    if (s > 0) scored.push([ix.ps[i].lang === lang ? s : s * 0.5, i]);
  });
  scored.sort((a, b) => b[0] - a[0]);
  const out: Passage[] = [], seen = new Set<string>();
  for (const [, i] of scored) {
    const p = ix.ps[i];
    if (p.lang !== lang || seen.has(p.url + p.section)) continue;
    seen.add(p.url + p.section);
    // a long section is stored in pieces; hand over the whole section, not only the piece that matched
    const whole = ix.ps.filter((o) => o.url === p.url && o.section === p.section).map((o) => o.text).join('\n');
    out.push({ ...p, text: whole.slice(0, 1400) });
    if (out.length >= k) break;
  }
  return out;
}

// Gemma 4 26B (MoE, 4B active): the cheapest capable chat model in the catalog (qwen3-30b-a3b was retired 2026-11-20).
// The reply reports the neurons it used; the day's total is kept in KV and the fallback stops at 9,000, under the
// free 10,000 neurons a day (reset 00:00 UTC), so it never costs money. A typical question uses about 35.
const CF_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const CF_NEURONS_PER_DAY = 9000;

async function cloudAnswer(env: Env, q: string, lang: 'zh-tw' | 'en', hits: Passage[]): Promise<string> {
  if (!env.AI || !env.ASK_DAY) return '';
  const key = `n:${new Date().toISOString().slice(0, 10)}`;
  const used = Number((await env.ASK_DAY.get(key)) ?? 0);
  if (used >= CF_NEURONS_PER_DAY) return '';
  const ctx = hits.map((p, i) => `[${i + 1}] ${p.title} › ${p.section}\n${p.text}`).join('\n\n') || '（沒有找到相關資料）';
  try {
    const out = (await env.AI.run(CF_MODEL, {
      messages: [
        { role: 'system', content: SYS[lang] + (lang === 'zh-tw' ? '\n\n網站資料：\n' : '\n\nSite passages:\n') + ctx },
        { role: 'user', content: q },
      ],
      max_tokens: 700,
      temperature: 0.3,
      // Gemma 4 thinks first by default and spends the whole budget on it; answer directly
      chat_template_kwargs: { enable_thinking: false },
    })) as { response?: string; choices?: { message?: { content?: string } }[]; usage?: { neurons?: number } };
    // count what was spent even when the answer comes back empty; a missing figure counts as a long question
    await env.ASK_DAY.put(key, String(used + (out.usage?.neurons ?? 60)), { expirationTtl: 172800 });
    const text = out.response ?? out.choices?.[0]?.message?.content ?? '';
    if (!text) console.log('workers ai empty', JSON.stringify(out).slice(0, 400));
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  } catch (e) {
    console.log('workers ai error', String(e));
    return '';
  }
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
  const page = (t: string) => t.replace(/\s*[｜|]\s*IFA Lab$/, '');
  const sources = hits.map((p) => ({
    title: p.section && p.section !== page(p.title) ? `${page(p.title)} · ${p.section}` : page(p.title),
    url: p.url,
    text: p.text.slice(0, 220),
  }));
  // 1) the lab's Spark, when a model is running there
  let sparkMode = '';
  if (env.ASK) {
    try {
      const r = await env.ASK.fetch('https://ask/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, lang, passages: hits.map(({ title, section, text }) => ({ title, section, text })) }),
      });
      const a = (await r.json()) as { answer?: string; mode?: string; model?: string };
      if (a.answer) return json({ answer: a.answer, mode: 'llm', via: 'spark', sources });
      sparkMode = a.mode ?? '';
    } catch { /* tunnel down: fall through */ }
  }
  // 2) Workers AI, up to the daily cap
  const answer = await cloudAnswer(env, q, lang as 'zh-tw' | 'en', hits);
  if (answer) return json({ answer, mode: 'llm', via: 'cloud', sources });
  // 3) the matching passages only
  return json({ answer: '', mode: sparkMode === 'warming' ? 'warming' : 'search', sources });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/ask') return ask(req, env);
    return env.ASSETS.fetch(req);
  },
};
