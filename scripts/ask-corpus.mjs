// After `astro build`: turn every built page into short text passages for the "問 K 喵" assistant.
// Writes dist/ask-corpus.json: [{ id, lang, url, title, section, text }]. The assistant service on the lab's
// DGX Spark downloads it from the live site and answers only from these passages, citing their URLs.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === 'index.html') files.push(p);
  }
})(DIST);

const decode = (s) => s
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
/** Drop every element hidden from assistive tech, nested children included (a regex stopped at the first closing
    tag and let the rest through: the clay loader's 正在捏黏土… ended up in the corpus). */
function dropHidden(html) {
  const open = /<([a-z][\w-]*)\b[^>]*\baria-hidden="true"[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    const tag = m[1].toLowerCase(), re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = m.index + m[0].length;
    let depth = 1, t, end = html.length;
    while (depth && (t = re.exec(html))) { if (t[1]) depth--; else if (!t[0].endsWith('/>')) depth++; if (!depth) end = t.index + t[0].length; }
    html = html.slice(0, m.index) + ' ' + html.slice(end);
    open.lastIndex = m.index;
  }
  return html;
}
// buttons are controls (換成黏土公仔, 複製引用), not content
const text = (html) => decode(dropHidden(html
  .replace(/<(script|style|noscript|svg|template|button)\b[\s\S]*?<\/\1>/gi, ' '))
  .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|dd|dt|tr|section|div)>/gi, '\n')
  .replace(/<[^>]+>/g, ' '))
  .replace(/[ \t ]+/g, ' ').replace(/ *\n[ \n]*/g, '\n').trim();

const out = [];
for (const f of files) {
  const rel = relative(DIST, f).split(sep).join('/');
  const url = '/' + rel.replace(/index\.html$/, '');
  if (!/^\/(zh-tw|en)\//.test(url)) continue;
  const html = readFileSync(f, 'utf8');
  if (/<meta name="robots" content="noindex/i.test(html)) continue;
  const lang = url.startsWith('/en/') ? 'en' : 'zh-tw';
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim());
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? '';
  // one passage per h2 section (h1 + intro is the first); long sections are cut at ~700 characters on a line break
  const parts = main.split(/(?=<h[12]\b)/i);
  const first = out.length;
  const h1 = text(main.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  for (let part of parts) {
    // each FAQ answer is its own passage under its question, so "收幾位" finds that answer and not the whole FAQ block
    const faqId = part.match(/<h2\b[^>]*\bid="([^"]+)"/i)?.[1];
    part = part.replace(/<section class="qa"[^>]*>([\s\S]*?)<\/section>/gi, (_, qa) => {
      const q = text(qa.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
      out.push({ id: out.length, lang, url: faqId ? `${url}#${faqId}` : url, title, section: q, text: text(qa) });
      return ' ';
    });
    const head = text(part.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ?? '');
    const id = part.match(/<h[12]\b[^>]*\bid="([^"]+)"/i)?.[1] ?? part.match(/<section\b[^>]*\bid="([^"]+)"/i)?.[1];
    const body = text(part);
    if (body.length < 20) continue;
    let buf = '';
    const flush = () => { if (buf.trim().length >= 20) out.push({ id: out.length, lang, url: id ? `${url}#${id}` : url, title, section: head, text: buf.trim() }); buf = ''; };
    for (const line of body.split('\n')) { if (buf.length + line.length > 700) flush(); buf += line + '\n'; }
    flush();
  }
  if (/\/members\/[^/]+\/$/.test(url) && h1) {
    const who = out.slice(first).find((p) => p.section === h1);
    const line = who?.text.split('\n').join(' · ');
    if (line) for (const p of out.slice(first)) if (p !== who && p.section) p.text = `（${line}）\n${p.text}`;
  }
}
writeFileSync(join(DIST, 'ask-corpus.json'), JSON.stringify(out));
const kb = statSync(join(DIST, 'ask-corpus.json')).size / 1024;
console.log(`✓ 問答語料：${out.length} 段，${kb.toFixed(0)} KB`);
