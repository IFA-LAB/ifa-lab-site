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

const TERMS: [RegExp, string][] = [
  [/處分效[果應]/, 'disposition'], [/動能/, 'momentum'], [/隨機優勢|隨機支配/, 'stochastic dominance'], [/波動/, 'volatility'],
  [/選擇權/, 'option'], [/放空|賣空/, 'short seller'], [/流動性/, 'liquidity'], [/違約/, 'default'], [/情緒/, 'sentiment'],
  [/共同基金|基金/, 'fund'], [/期貨/, 'futures'], [/定價/, 'pricing'], [/死亡率|長壽/, 'mortality'], [/碳|排放權/, 'emission'],
  [/資安|網路安全/, 'cybersecurity'], [/財報/, 'financial report'], [/借貸|P2P/i, 'p2p lending'],
];

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

/** A question that asks two things (研究什麼？怎麼申請？ / what … and how …) is searched part by part and the
 *  results interleaved, so the second part is not crowded out by passages matching the first. */
function search(ix: Index, q: string, lang: string, k = 5): Passage[] {
  const raw = q.split(/[？?；;]+|\band (?=how|what|where|when|who|which|can|do)|，(?=要|怎|有沒有|可以|那)/i).map((s) => s.trim()).filter((s) => s.length >= 2);
  // a short follow-up (刊在哪？ / Which journals?) is about the first part, not a topic of its own: searched alone,
  // 刊在哪 found 學長姐畢業後去哪裡
  const parts: string[] = [];
  for (const s of raw) if (parts.length && [...s].length < (/[a-z]/i.test(s) ? 16 : 5)) parts[parts.length - 1] += ` ${s}`; else parts.push(s);
  if (parts.length < 2) return searchOne(ix, q, lang, k);
  const lists = parts.slice(0, 3).map((p) => searchOne(ix, p, lang, 3));
  const out: Passage[] = [], seen = new Set<string>();
  for (let r = 0; r < 3; r++) for (const l of lists) {
    const p = l[r];
    if (p && !seen.has(p.url + p.section) && out.length < k + 1) { seen.add(p.url + p.section); out.push(p); }
  }
  return out;
}

/** BM25 over the passages, preferring the visitor's language; one passage per page section. */
function searchOne(ix: Index, q: string, lang: string, k = 5): Passage[] {
  // short forms people type for the headings the site uses
  let qn = q.replace(/碩論/g, '碩士論文').toLowerCase();
  // how people ask to join: the site answers under 加入 / 寄信 and "join" / "email"
  if (/申請|報名|考進|進實驗室|進 ?lab/.test(qn)) qn += ' 加入 寄信';
  // 財務 and 金融 are used for the same thing (the FAQ says 對金融有興趣很好，沒有也沒關係)
  if (qn.includes('財務') && !qn.includes('金融')) qn += ' 金融';
  // "I didn't study X, can I…": the answer is the FAQ on who the lab is for, not the one on undergraduates
  if (/不是讀|沒學過|沒修過|沒有.{0,4}背景|非本科|跨領域|轉領域/.test(qn)) qn += ' 適合 什麼樣 學生 沒關係';
  if (/\b(background|not from|never studied|no experience|didn't study)\b/.test(qn)) qn += ' who is ifa lab for';
  if (/\b(apply|applying|application|admission|get in)\b/.test(qn)) qn += ' join email';
  // Chinese names for methods the papers write in English or under another Chinese name: 圖神經網路 never met the
  // SeqTAG pages, which say 圖卷積 and "graph"
  if (/圖神經|圖網路|圖模型|\bgnn\b/.test(qn)) qn += ' 圖卷積 因果圖 graph';
  if (/語言模型|\bllm\b|\bgpt\b/.test(qn)) qn += ' llm 生成式';
  if (/深度學習|神經網路/.test(qn)) qn += ' 深度 機器學習 lstm gru';
  // paper titles and abstracts are English: a Chinese finance term also searches for the English one
  for (const [re, en] of TERMS) if (re.test(qn)) qn += ` ${en}`;
  // how to work with the lab: the collaboration page, not the join steps that also say "寄信"
  if (/產學|合作|企業|公司/.test(qn)) qn += ' 產學合作 合作 兆豐';
  if (/\b(collaborat\w*|partner\w*|compan\w*|industry)\b/.test(qn)) qn += ' collaboration industry';
  // does the question name a member? then their pages lead; otherwise the lab's own pages do
  const named = ix.ps.some((p) => { const w = p.title.split(/\s*[｜|]\s*/)[0].toLowerCase(); return p.url.includes('/members/') && w.length >= 2 && !w.startsWith('ifa lab') && qn.includes(w); });
  const qs = count(grams(qn));
  const rare = [...qs.keys()].filter((t) => /^[a-z]/.test(t) && t.length >= 2 && (ix.df.get(t) ?? 0) > 0 && (ix.df.get(t) ?? 0) / ix.ps.length < 0.08);
  const scored: [number, number][] = [];
  ix.docs.forEach((d, i) => {
    let s = 0;
    for (const t of qs.keys()) {
      const f = d.get(t);
      if (!f) continue;
      const n = ix.df.get(t) ?? 0;
      const idf = Math.log(1 + (ix.ps.length - n + 0.5) / (n + 0.5));
      // a Chinese question is mostly single characters (實 驗 室 有 做 過…) that every page has; together they outweighed
      // the one word that mattered ("ESG"), and the ESG paper never came back. Single characters count a third,
      // a Latin word or acronym counts double.
      const w = /^[a-z0-9]/.test(t) ? 2 : t.length === 1 ? 0.33 : 1;
      s += (w * idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * ix.lens[i]) / ix.avg));
    }
    // the question names this section's heading (碩士論文, 經歷, thesis…): that section answers it, however long it is
    // (length normalisation had put a 505-character 碩士論文 below a short 論文 list that marks the same work 工作論文)
    const sec = ix.ps[i].section.toLowerCase();
    if (s > 0 && sec.length >= 2 && (qn.includes(sec) || sec.split(/[\s'’?？]+/).some((w) => w.length >= 5 && qn.includes(w)))) s *= 1.6;
    // the question names a person: their own page comes before other members' sections on the same topic
    const who = ix.ps[i].title.split(/\s*[｜|]\s*/)[0].toLowerCase();
    if (s > 0 && who.length >= 2 && !who.startsWith('ifa lab') && qn.includes(who)) s *= 1.5;
    if (s > 0 && !named && ix.ps[i].url.includes('/members/')) s *= 0.6;
    // a rare English word or acronym in the question (ESG, LLM, GNN) is what the question is about: pages that have it lead
    if (s > 0 && rare.some((t) => d.has(t))) s *= 2.5;
    if (s > 0) scored.push([ix.ps[i].lang === lang ? s : s * 0.5, i]);
  });
  scored.sort((a, b) => b[0] - a[0]);
  const out: Passage[] = [], seen = new Set<string>(), perSection = new Map<string, number>();
  for (const [, i] of scored) {
    const p = ix.ps[i];
    if (p.lang !== lang || seen.has(p.url + p.section)) continue;
    seen.add(p.url + p.section);
    // at most two pages' copy of the same heading (Research interests ×5 crowded out the join steps)
    const h = p.section.toLowerCase(), n = perSection.get(h) ?? 0;
    if (n >= 2) continue;
    perSection.set(h, n + 1);
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

/** Citations the chat can link: "[3, 4]" becomes "[3][4]", and a number with no source behind it is dropped
 *  (a refusal once ended in a bare "[3, 4]"). */
function cite(answer: string, n: number): string {
  return answer
    .replace(/\[(\d+(?:\s*[,，、]\s*\d+)+)\]/g, (_, list: string) => list.split(/\s*[,，、]\s*/).map((k) => `[${k}]`).join(''))
    .replace(/\s*\[(\d+)\]/g, (m, k: string) => (+k >= 1 && +k <= n ? m : ''))
    // the same source twice in a row ("[1][1]", once shown as "1, 1") reads as a glitch
    .replace(/\[(\d+)\](?:\s*\[\1\])+/g, '[$1]')
    // a space between Chinese and Latin letters or digits ("由Chao-Jung Chen" → "由 Chao-Jung Chen"); models skip it despite the prompt
    .replace(/([一-鿿])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9%])([一-鿿])/g, '$1 $2')
    .trim();
}

/** The model still made up Chinese names for co-authors the site names only in English ("陳昭仲（Chao-Jung Chen）")
 *  despite the prompt. A Chinese name beside an English one stays only if the passages contain it; otherwise the
 *  English name, as written in the data, is all that is left. */
function realNames(answer: string, passages: { text: string }[]): string {
  const seen = (zh: string) => passages.some((p) => p.text.includes(zh));
  const en = String.raw`[A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+)+`;
  return answer
    // up to four characters before the bracket: a leading 和／與／及／跟／由 is the sentence, not the name
    .replace(new RegExp(String.raw`([一-鿿]{2,4})\s*[（(]\s*(${en})\s*[）)]`, 'g'), (m, run: string, name: string) => {
      const lead = run.length > 2 && /^[和與及跟由是、]/.test(run) ? run[0] : '';
      return seen(run.slice(lead.length)) ? m : lead + name;
    })
    .replace(new RegExp(String.raw`(${en})\s*[（(]\s*([一-鿿]{2,4})\s*[）)]`, 'g'), (m, name: string, zh: string) => (seen(zh) ? m : name));
}

const json = (o: unknown, status = 200) => Response.json(o, { status, headers: { 'Cache-Control': 'no-store' } });

async function ask(req: Request, env: Env): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const origin = new URL(req.url).origin;
  if (req.headers.get('Origin') && req.headers.get('Origin') !== origin) return json({ error: 'forbidden' }, 403);
  const ip = req.headers.get('CF-Connecting-IP') ?? 'anon';
  if (env.ASK_LIMIT && !(await env.ASK_LIMIT.limit({ key: ip })).success) return json({ error: 'slow down', mode: 'limited' }, 429);
  let q = '', lang = 'zh-tw', at = '';
  try {
    const b = (await req.json()) as { q?: unknown; lang?: unknown; page?: unknown };
    q = String(b.q ?? '').trim().slice(0, 400);
    lang = b.lang === 'en' ? 'en' : 'zh-tw';
    at = String(b.page ?? '').slice(0, 200);
  } catch { return json({ error: 'bad request' }, 400); }
  if (q.length < 2) return json({ error: 'empty question' }, 400);

  cached ??= loadIndex(env, origin).catch((e) => { cached = null; throw e; });
  const ix = await cached;
  // "this paper" / "這篇" / "他的" asked on a paper or member page means that page
  const deictic = /這篇|本篇|這份|這位|這個人|他的|她的|\bthis (paper|study|article|person|member)\b|\b(his|her|their) (research|papers?|thesis)\b/i.test(q);
  // asked from a paper's or member's own page about that page (the suggested questions name it): that page's passages
  // lead, so "the main finding?" is answered from the paper itself, not from the research overview's one-line entry
  const own = /^\/(zh-tw|en)\/(papers|members)\/[a-z0-9-]+\/$/.test(at)
    ? ix.ps.filter((p) => p.lang === lang && p.url.split('#')[0] === at && !/引用|cite/i.test(p.section) && (deictic || q.toLowerCase().includes(p.title.split(/\s*[｜|]\s*/)[0].toLowerCase().slice(0, 12))))
    : [];
  // "this paper" with the page's own passages: answer from that page only (its findings, abstract, thesis first, related
  // lists dropped), and name the page in the question, so the model cannot borrow a neighbouring paper's or person's lines
  const rank = (p: (typeof own)[number]) => { const h = p.url.split('#')[1] ?? ''; return /pts|abs|thesis/.test(h) ? 0 : /rel-h/.test(h) ? 9 : 1; };
  const mine = deictic && own.length ? own.filter((p) => rank(p) < 9 && p.text.length > 40).sort((a, b) => rank(a) - rank(b)).slice(0, 4) : [];
  const hits = mine.length ? mine : [...own.slice(0, 2), ...search(ix, q, lang).filter((h) => !own.includes(h))].slice(0, 5);
  if (mine.length) q = `${q}（${lang === 'en' ? 'about: ' : '指的是：'}${mine[0].title.split(/\s*[｜|]\s*/)[0]}）`;
  // the page's own name: the title before its first separator (the home page's long SEO title included)
  const page = (t: string) => t.split(/\s*[｜|]\s*/)[0];
  const sources = hits.map((p) => ({
    title: p.section && p.section !== page(p.title) ? `${page(p.title)} · ${p.section}` : page(p.title),
    // the citation block is not where the content is: point at the page itself
    url: p.url.replace(/#cite-h$/, ''),
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
      if (a.answer) return json({ answer: cite(realNames(a.answer, hits), sources.length), mode: 'llm', via: 'spark', sources });
      sparkMode = a.mode ?? '';
    } catch { /* tunnel down: fall through */ }
  }
  // 2) Workers AI, up to the daily cap
  const answer = await cloudAnswer(env, q, lang as 'zh-tw' | 'en', hits);
  if (answer) return json({ answer: cite(realNames(answer, hits), sources.length), mode: 'llm', via: 'cloud', sources });
  // 3) the matching passages only
  return json({ answer: '', mode: sparkMode === 'warming' ? 'warming' : 'search', sources });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    // one copy of every page: plain http moves to https for good
    if (url.protocol === 'http:') { url.protocol = 'https:'; return Response.redirect(url.href, 301); }
    if (url.pathname === '/api/ask') return ask(req, env);
    // the asset server would answer /zh-tw/members with a temporary 307; search engines want a permanent move
    if (!url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname)) { url.pathname += '/'; return Response.redirect(url.href, 301); }
    const res = await env.ASSETS.fetch(req);
    // the asset server sends HTML as bare text/html; say the encoding in the header too (the page's <meta charset> only
    // counts once the first bytes are read)
    if (res.headers.get('Content-Type') === 'text/html') {
      const out = new Response(res.body, res);
      out.headers.set('Content-Type', 'text/html; charset=utf-8');
      return out;
    }
    return res;
  },
};
