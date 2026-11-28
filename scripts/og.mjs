// Share cards: one 1200×630 image per indexed page, so a link pasted into LINE, Facebook, Slack or a search result
// shows that page's own title (and a member's photo, a paper's journal) instead of the same home-page shot everywhere.
//
//   npm run build && node scripts/og.mjs && npm run build
//
// Reads the built pages in dist/, draws each card as HTML in headless Chrome (local machine: needs Chrome), and
// writes public/og/<lang>/<slug>.jpg. Base.astro uses the card when the file exists. The cards are committed:
// re-run this after a page title, a member photo or a paper changes.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'public', 'og');
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = join(tmpdir(), 'ifa-og');
mkdirSync(TMP, { recursive: true });

// the site's light-theme tokens (src/styles/global.css); an image cannot read CSS variables
const C = { surface: '#ffffff', surface2: '#e3e9f0', ink: '#1d2633', ink2: '#4a5668', accent: '#3c6db5',
  blue: '#4f7fc4', up: '#e2574c', down: '#2e9d6e', sun: '#f2b544', pink: '#ee9aae', violet: '#9a86d6', grey: '#b8c2cf' };
const AREA = { empirical: C.blue, behavioral: C.pink, pricing: C.sun, ai: C.violet, forecast: C.down, apps: C.up };
const CJK = /[㐀-鿿]/;
// fonts go in as data URLs: a file:// font may not have loaded when headless Chrome takes the shot
const font = (p) => `data:font/woff2;base64,${readFileSync(p).toString('base64')}`;
const FONTS = `
@font-face { font-family: Huninn; font-weight: 400 700; src: url(${font(join(DIST, 'fonts/huninn-sub.woff2'))}); }
@font-face { font-family: Fredoka; font-weight: 600; src: url(${font(join(ROOT, 'node_modules/@fontsource/fredoka/files/fredoka-latin-600-normal.woff2'))}); }`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
const strip = (s) => dec(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const meta = (h, k) => dec(h.match(new RegExp(`<meta (?:name|property)="${k}" content="([^"]*)"`))?.[1] ?? '');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
// a Chinese title breaks only between words (真實的問題, not 問／題): <wbr> at word boundaries, keep-all elsewhere
const seg = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
const wordsHtml = (s) => [...seg.segment(s)].map((x, i, a) => (i && CJK.test(a[i - 1].segment.slice(-1)) && CJK.test(x.segment[0]) ? '<wbr>' : '') + esc(x.segment)).join('');

const pages = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === 'index.html') pages.push(p); } })(DIST);

/** A photo from the built site, if the page shares one. */
const photo = (h) => {
  // the person's photo from JSON-LD: og:image points at this card itself once the card exists
  const img = h.match(/"image":"(https:\/\/ifalab-ncu\.com\/_astro\/[^"]+)"/)?.[1] ?? '';
  const local = img.startsWith('https://ifalab-ncu.com/_astro/') ? join(DIST, img.replace('https://ifalab-ncu.com/', '')) : '';
  return local && existsSync(local) ? `<img class="photo" src="${pathToFileURL(local).href}">` : '';
};

function card(lang, path, h) {
  const zh = lang === 'zh-tw';
  // an <h1 class="lines"> sets each <span> on its own line: keep those breaks ('|') on the card
  const h1m = h.match(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/);
  const h1 = strip(/class="[^"]*\blines\b/.test(h1m?.[1] ?? '') ? h1m[2].replace(/<\/span>\s*<span\b/g, '</span>|<span') : h1m?.[2] ?? '');
  const [kind, rest] = path.split('/');
  let label = '', title = h1, sub = '', side = '';
  // the lab's own climb: six areas, rising, like the home page's K line
  const bars = (cols) => `<div class="bars">${cols.map((c, i) => `<i style="background:${c};height:${90 + i * 46}px"></i>`).join('')}</div>`;
  const defBars = bars([C.blue, C.pink, C.sun, C.violet, C.down, C.up]);
  if (!kind) {
    label = zh ? '國立中央大學 資訊管理學系' : 'NCU · Information Management';
    // '|' marks a forced line break in a card title
    title = zh ? '智能金融|分析實驗室' : 'Intelligent Finance|Analytics Lab';
    sub = zh ? '用台灣市場的資料檢驗財務理論，再把它做成用得上的模型。' : 'Testing finance theory on Taiwan market data, and building models people can use.';
    side = defBars;
  } else if (kind === 'papers') {
    const area = h.match(/data-area="([a-z]+)"/)?.[1];
    const journal = meta(h, 'citation_journal_title'), year = meta(h, 'citation_publication_date');
    label = strip(h.match(/<p class="eyebrow"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '') || (zh ? '論文' : 'Paper');
    title = meta(h, 'citation_title') || h1;
    sub = journal || (zh ? '工作論文' : 'Working paper');
    if (year && !label.includes(year)) sub += ` · ${year}`;
    const c = AREA[area] ?? C.blue;
    side = bars([C.grey, C.grey, c, C.grey, c, c]);
  } else if (kind === 'members' && rest) {
    label = zh ? 'IFA Lab 成員' : 'IFA Lab member';
    sub = clip(meta(h, 'description'), zh ? 70 : 110);
    side = photo(h) || defBars;
  } else if (kind === 'advisor') {
    label = zh ? '指導教授' : 'Advisor';
    sub = zh ? '國立中央大學資訊管理學系 副教授兼副系主任' : 'Associate Professor and Deputy Chair, NCU Information Management';
    side = photo(h) || defBars;
  } else {
    label = strip(h.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').split(/[｜|]/)[0].trim();
    if (label === h1) label = 'IFA Lab';
    sub = clip(meta(h, 'description'), zh ? 64 : 110);
    side = defBars;
  }
  const cjk = CJK.test(title);
  // a two-line title ('|') shrinks when either line is long; a one-line title when it would wrap past two lines
  const lines = title.split('|');
  const long = lines.length > 1 ? lines.some((l) => l.length > (cjk ? 12 : 24)) : title.length > (cjk ? 16 : 40);
  // English cards: a Latin face first, or the CJK font sets ’ full width (master’ s)
  const text = zh ? "'Noto Sans TC', 'Microsoft JhengHei', sans-serif" : "'Segoe UI', Arial, 'Noto Sans TC', sans-serif";
  return `<!doctype html><meta charset="utf-8"><style>${FONTS}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: ${C.surface2}; font-family: Fredoka, Huninn, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif; color: ${C.ink}; }
  .card { position: absolute; inset: 36px; border-radius: 40px; background: ${C.surface}; box-shadow: 0 18px 40px rgb(29 38 51 / 0.12), inset 0 -6px 0 rgb(0 0 0 / 0.05); display: grid; grid-template-columns: 1fr 340px; gap: 40px; padding: 56px 64px; }
  .text { display: flex; flex-direction: column; min-width: 0; }
  .brand { display: flex; align-items: center; gap: 14px; font: 600 26px/1 Fredoka, 'Noto Sans TC', sans-serif; }
  .brand img { height: 34px; }
  .label { margin-top: 40px; font: 600 24px/1.3 ${text}; color: ${C.accent}; }
  h1 { margin-top: 12px; font-size: ${long ? 48 : title.includes('|') && !cjk ? 64 : 76}px; line-height: 1.2; font-weight: 600; letter-spacing: ${cjk ? '0' : '-0.01em'}; display: -webkit-box; -webkit-line-clamp: ${long ? 4 : 2}; -webkit-box-orient: vertical; overflow: hidden; text-wrap: balance; word-break: ${cjk ? 'keep-all' : 'normal'}; overflow-wrap: anywhere; }
  .sub { margin-top: auto; padding-top: 20px; font: 400 26px/1.5 ${text}; color: ${C.ink2}; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .side { display: grid; place-items: end center; }
  .bars { display: flex; align-items: flex-end; gap: 14px; height: 100%; padding-bottom: 8px; }
  .bars i { display: block; width: 40px; border-radius: 12px; box-shadow: inset -5px -7px 0 rgb(0 0 0 / 0.14), inset 4px 4px 0 rgb(255 255 255 / 0.35); }
  .photo { width: 300px; height: 300px; border-radius: 50%; object-fit: cover; align-self: center; box-shadow: 0 12px 28px rgb(29 38 51 / 0.18); border: 10px solid ${C.surface2}; }
  </style><div class="card"><div class="text">
    <div class="brand"><img src="${pathToFileURL(join(DIST, 'logo.png')).href}">IFA Lab</div>
    <p class="label">${esc(label)}</p><h1>${title.split('|').map(wordsHtml).join('<br>')}</h1><p class="sub">${esc(sub)}</p>
  </div><div class="side">${side}</div></div>`;
}

let n = 0;
for (const f of pages) {
  const url = relative(DIST, f).split(sep).join('/').replace(/index\.html$/, '');
  const m = url.match(/^(zh-tw|en)\/(.*)$/);
  if (!m) continue;
  const h = readFileSync(f, 'utf8');
  if (/<meta name="robots" content="noindex/.test(h)) continue;
  const [, lang, path] = m;
  const slug = path.replace(/\/$/, '').replace(/\//g, '_') || 'home';
  const html = join(TMP, `${lang}-${slug}.html`), png = join(TMP, `${lang}-${slug}.png`);
  writeFileSync(html, card(lang, path.replace(/\/$/, ''), h));
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files',
    '--virtual-time-budget=2000', `--screenshot=${png}`, '--window-size=1200,630', pathToFileURL(html).href], { stdio: 'ignore' });
  mkdirSync(join(OUT, lang), { recursive: true });
  await sharp(png).resize(1200, 630).jpeg({ quality: 82, mozjpeg: true }).toFile(join(OUT, lang, `${slug}.jpg`));
  n++;
}
rmSync(TMP, { recursive: true, force: true });
console.log(`✓ 分享卡片：${n} 張，public/og/`);
