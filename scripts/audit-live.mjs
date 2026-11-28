// The live site, checked the way a search engine, a browser and a share preview see it.
// Run after every deploy (CI) or by hand: node scripts/audit-live.mjs [https://ifalab-ncu.com]
// Prints one line per check: PASS, WARN (worth a look, does not fail) or FAIL (exit code 1).
// It exists because a missing piece (the 48-px site icon Google needs) went unnoticed until someone saw a blank globe.
const BASE = (process.argv[2] ?? 'https://ifalab-ncu.com').replace(/\/$/, '');
const HOST = new URL(BASE).host;
const results = [];
const out = (level, id, msg) => { results.push({ level, id, msg }); console.log(`${level.padEnd(4)}  ${id.padEnd(22)} ${msg}`); };
const pass = (id, msg) => out('PASS', id, msg), warn = (id, msg) => out('WARN', id, msg), fail = (id, msg) => out('FAIL', id, msg);
const check = (ok, id, msg, soft = false) => (ok ? pass(id, msg) : soft ? warn(id, msg) : fail(id, msg));

const UA = 'Mozilla/5.0 (compatible; ifa-lab-audit/1.0)';
const cache = new Map();
/** fetch without following redirects; cached per URL */
async function get(url, opts = {}) {
  const key = url + (opts.method ?? '') + (opts.follow ? 'f' : '');
  if (!opts.method && cache.has(key)) return cache.get(key);
  const p = (async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(url, { redirect: opts.follow ? 'follow' : 'manual', method: opts.method ?? 'GET', headers: { 'User-Agent': UA, 'Accept-Encoding': 'br, gzip', ...(opts.headers ?? {}) }, body: opts.body });
        const buf = Buffer.from(await r.arrayBuffer());
        return { status: r.status, headers: r.headers, buf, text: () => buf.toString('utf8'), url: r.url };
      } catch (e) { if (i === 2) return { status: 0, headers: new Headers(), buf: Buffer.alloc(0), text: () => '', error: String(e) }; }
    }
  })();
  if (!opts.method) cache.set(key, p);
  return p;
}
const pool = async (items, n, fn) => { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); };

/** pixel size of a PNG, JPEG or ICO (largest entry) from its bytes */
function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  if (b.length > 6 && b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1) {
    let best = [0, 0];
    for (let k = 0; k < b.readUInt16LE(4); k++) { const w = b[6 + k * 16] || 256, h = b[7 + k * 16] || 256; if (w > best[0]) best = [w, h]; }
    return best;
  }
  return null;
}
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((x) => x !== undefined);
const metas = (html) => [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
const meta = (html, key) => { const t = metas(html).find((m) => attr(m, 'name') === key || attr(m, 'property') === key); return t ? attr(t, 'content') : undefined; };
const links = (html, rel) => [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => (attr(t, 'rel') ?? '').split(/\s+/).includes(rel));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// ───────────────────────── 1. transport: one address per page, permanent moves only
{
  const r = await get(`http://${HOST}/zh-tw/`);
  check(r.status === 301 && r.headers.get('location') === `https://${HOST}/zh-tw/`, 'http-to-https', `http:// → ${r.status} ${r.headers.get('location')}`);
  const w = await get(`https://www.${HOST}/zh-tw/research/`);
  check([301, 308].includes(w.status) && w.headers.get('location') === `https://${HOST}/zh-tw/research/`, 'www-to-apex', `www → ${w.status} ${w.headers.get('location')} (keeps the path)`);
  const s = await get(`${BASE}/zh-tw/research`);
  check(s.status === 301 && s.headers.get('location')?.endsWith('/zh-tw/research/'), 'trailing-slash', `/zh-tw/research → ${s.status} ${s.headers.get('location')}`);
  const root = await get(`${BASE}/`);
  check([200, 301, 302].includes(root.status), 'root', `/ → ${root.status} ${root.headers.get('location') ?? ''}`);
  const nf = await get(`${BASE}/no-such-page-${Date.now()}/`);
  check(nf.status === 404, '404-status', `unknown page → ${nf.status}`);
  check(/noindex/i.test(meta(nf.text(), 'robots') ?? ''), '404-noindex', '404 page says noindex', true);
  const old = await get('https://ifa-lab.jushenhuang-jason.workers.dev/zh-tw/');
  check(old.status === 0 || [301, 308, 404, 410].includes(old.status) || /noindex/i.test(meta(old.text(), 'robots') ?? ''), 'old-domain', `old workers.dev address → ${old.status || old.error} ${old.headers.get('location') ?? ''} (must not serve a duplicate copy)`);
}

// ───────────────────────── 2. headers
{
  const r = await get(`${BASE}/zh-tw/`);
  const h = r.headers;
  check(/text\/html/.test(h.get('content-type') ?? '') && /utf-8/i.test(h.get('content-type') ?? ''), 'html-content-type', `HTML content-type: ${h.get('content-type')}`);
  check(/max-age=\d{7,}/.test(h.get('strict-transport-security') ?? ''), 'hsts', `HSTS: ${h.get('strict-transport-security')}`);
  check((h.get('x-content-type-options') ?? '') === 'nosniff', 'nosniff', `X-Content-Type-Options: ${h.get('x-content-type-options')}`);
  check(!!h.get('referrer-policy'), 'referrer-policy', `Referrer-Policy: ${h.get('referrer-policy')}`);
  check(!!(h.get('x-frame-options') || /frame-ancestors/.test(h.get('content-security-policy') ?? '')), 'clickjacking', `X-Frame-Options/frame-ancestors: ${h.get('x-frame-options') ?? h.get('content-security-policy')}`, true);
  check(/br|gzip/.test(h.get('content-encoding') ?? ''), 'compression', `HTML content-encoding: ${h.get('content-encoding')}`);
  const html = r.text();
  const asset = html.match(/\/_astro\/[^"']+\.(?:js|css)/)?.[0];
  if (asset) { const a = await get(BASE + asset); check(/immutable/.test(a.headers.get('cache-control') ?? '') && /max-age=31536000/.test(a.headers.get('cache-control') ?? ''), 'asset-cache', `${asset.slice(0, 40)}… cache-control: ${a.headers.get('cache-control')}`); }
  check(!/immutable/.test(h.get('cache-control') ?? ''), 'html-cache', `HTML cache-control: ${h.get('cache-control') ?? '(none: revalidated)'}`);
}

// ───────────────────────── 3. files every site is expected to have
const sitemapUrls = [];
{
  const robots = await get(`${BASE}/robots.txt`);
  const rt = robots.text();
  check(robots.status === 200 && /^user-agent:\s*\*/im.test(rt) && !/^disallow:\s*\/\s*$/im.test(rt.split(/user-agent:\s*\*/i)[1]?.split(/user-agent/i)[0] ?? ''), 'robots.txt', `robots.txt ${robots.status}, allows all`);
  const sm = rt.match(/^sitemap:\s*(\S+)/im)?.[1];
  check(!!sm && sm.startsWith('https://'), 'robots-sitemap', `robots.txt names its sitemap: ${sm}`);
  const idx = sm ? await get(sm) : null;
  const subs = idx ? [...idx.text().matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [];
  const xmls = /<sitemapindex/.test(idx?.text() ?? '') ? subs : [sm];
  for (const x of xmls) { const r = await get(x); for (const m of r.text().matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.push(decode(m[1])); }
  check(sitemapUrls.length > 10, 'sitemap', `sitemap lists ${sitemapUrls.length} pages`);
  check(sitemapUrls.every((u) => u.startsWith(BASE + '/')), 'sitemap-origin', 'every sitemap URL is on this origin, https');
  const sx = await get(xmls[0]);
  check(/xhtml:link[^>]+hreflang/.test(sx.text()), 'sitemap-hreflang', 'sitemap carries hreflang alternates', true);

  for (const [p, type, size] of [['/favicon.ico', /icon/, null], ['/favicon.svg', /svg/, null], ['/icon-48.png', /png/, 48], ['/icon-96.png', /png/, 96], ['/icon-192.png', /png/, 192], ['/apple-touch-icon.png', /png/, 180], ['/logo.png', /png/, null]]) {
    const r = await get(BASE + p);
    const dim = imageSize(r.buf);
    check(r.status === 200 && type.test(r.headers.get('content-type') ?? '') && (!size || (dim && dim[0] === size && dim[1] === size)), `file ${p}`, `${r.status} ${r.headers.get('content-type')} ${dim ? dim.join('×') : ''}`);
  }
  const ico = imageSize((await get(`${BASE}/favicon.ico`)).buf);
  check(!!ico && ico[0] >= 32, 'favicon.ico-size', `favicon.ico largest entry ${ico?.join('×')}`);
  const llms = await get(`${BASE}/llms.txt`);
  check(llms.status === 200 && llms.text().length > 200, 'llms.txt', `llms.txt ${llms.status}, ${llms.text().length} chars`);
  const home = (await get(`${BASE}/zh-tw/`)).text();
  const man = links(home, 'manifest')[0];
  if (man) {
    const m = await get(new URL(attr(man, 'href'), BASE).href);
    let j = null; try { j = JSON.parse(m.text()); } catch {}
    check(m.status === 200 && j?.name && j?.icons?.some((i) => /192/.test(i.sizes)) && j?.icons?.some((i) => /512/.test(i.sizes)), 'manifest', `web manifest ${m.status}: name ${j?.name}, icons ${j?.icons?.map((i) => i.sizes).join(',')}`);
  } else fail('manifest', 'no <link rel="manifest"> (Android home screen, installable icon)');
  const sec = await get(`${BASE}/.well-known/security.txt`);
  check(sec.status === 200 && /^contact:/im.test(sec.text()) && /^expires:/im.test(sec.text()), 'security.txt', `/.well-known/security.txt ${sec.status}`, true);
  const api = await get(`${BASE}/api/ask`);
  check(api.status === 405, 'api-get', `GET /api/ask → ${api.status} (POST only)`);
  const foreign = await get(`${BASE}/api/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{"q":"hi"}' });
  check(foreign.status === 403, 'api-origin', `POST /api/ask from another origin → ${foreign.status}`);
}

// ───────────────────────── 4. every page in the sitemap
const pages = new Map(); // url → { html, title, desc }
const linked = new Map(); // internal href → first page that links it
const images = new Map(); // image src → first page
await pool(sitemapUrls, 6, async (u) => {
  const r = await get(u);
  if (r.status !== 200) { fail('page-status', `${u} → ${r.status} ${r.headers.get('location') ?? ''}`); return; }
  const html = r.text();
  const path = new URL(u).pathname, lang = path.startsWith('/en/') ? 'en' : 'zh-tw';
  const bad = [];
  const want = (ok, what) => { if (!ok) bad.push(what); };
  const htmlLang = html.match(/<html\b[^>]*\slang="([^"]+)"/i)?.[1];
  want(lang === 'en' ? htmlLang === 'en' : /^zh-(Hant|TW)/i.test(htmlLang ?? ''), `html lang=${htmlLang}`);
  want(/<meta charset="utf-8"/i.test(html), 'meta charset');
  const vp = meta(html, 'viewport') ?? '';
  want(/width=device-width/.test(vp) && !/user-scalable\s*=\s*(no|0)/.test(vp) && !/maximum-scale\s*=\s*1(\.0)?\b/.test(vp), `viewport "${vp}"`);
  const title = decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '').trim();
  const desc = decode(meta(html, 'description') ?? '');
  want(title.length > 0, 'title'); want(desc.length > 0, 'description');
  const noindex = /noindex/i.test(meta(html, 'robots') ?? '');
  want(!noindex, 'noindex page listed in the sitemap');
  const canon = attr(links(html, 'canonical')[0] ?? '', 'href');
  want(canon === u, `canonical ${canon}`);
  const alts = links(html, 'alternate').filter((t) => attr(t, 'hreflang')).map((t) => [attr(t, 'hreflang'), attr(t, 'href')]);
  const al = Object.fromEntries(alts);
  want(!!al['en'] && Object.keys(al).some((k) => /^zh/i.test(k)) && !!al['x-default'], `hreflang set ${Object.keys(al).join(',') || '(none)'}`);
  want(Object.values(al).includes(u), 'hreflang does not include the page itself');
  for (const [k, v] of [['og:title'], ['og:description'], ['og:image'], ['og:url'], ['og:type'], ['og:site_name'], ['og:locale'], ['twitter:card']].map(([k]) => [k, meta(html, k)])) want(!!v, k);
  want(meta(html, 'og:url') === u, `og:url ${meta(html, 'og:url')}`);
  const ogi = meta(html, 'og:image');
  if (ogi) { if (!ogi.startsWith('https://')) bad.push('og:image not absolute https'); images.set('OG ' + decode(ogi), u); }
  want(!!meta(html, 'theme-color'), 'theme-color');
  want(links(html, 'icon').length > 0 && links(html, 'apple-touch-icon').length > 0, 'icon links');
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  want(h1 === 1, `${h1} <h1>`);
  // structured data: parses, and the types Google checks have what Google requires
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1]); } catch (e) { bad.push('JSON-LD does not parse'); continue; }
    const graph = j['@graph'] ?? [j];
    for (const g of graph) {
      const t = [].concat(g['@type']);
      if (t.includes('ProfilePage')) want(!!g.mainEntity?.name, 'ProfilePage.mainEntity');
      if (t.includes('FAQPage')) want(Array.isArray(g.mainEntity) && g.mainEntity.length > 0 && g.mainEntity.every((q) => q.name && q.acceptedAnswer?.text), 'FAQPage questions');
      if (t.includes('ScholarlyArticle') || t.includes('Article')) want(!!g.headline && (g.author?.length ?? 0) > 0 && !!g.datePublished, `${t} headline/author/datePublished`);
      if (t.includes('Person')) want(!!g.name, 'Person.name');
      if (t.includes('Organization') || t.includes('ResearchOrganization')) want(!!g.name && !!g.url && !!g.logo, 'Organization name/url/logo');
      const bc = g.breadcrumb ?? (t.includes('BreadcrumbList') ? g : null);
      if (bc) want(bc.itemListElement?.every((i, k) => i.position === k + 1 && i.name && i.item), 'BreadcrumbList items');
    }
  }
  // images: described, sized (no layout shift)
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0], src = attr(t, 'src');
    // a bare `alt` is alt="" (decorative): present
    if (!/\salt(?=[\s=>/])/i.test(t)) bad.push(`img without alt ${src}`);
    if (!attr(t, 'width') || !attr(t, 'height')) bad.push(`img without width/height ${src}`);
    if (src && !src.startsWith('data:')) images.set(new URL(decode(src), u).href, u);
  }
  // mixed content
  if (/\s(?:src|href)="http:\/\//i.test(html.replace(/<a\b[^>]*>/gi, ''))) bad.push('http:// resource (mixed content)');
  // internal links
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"#]+)/gi)) {
    const h = decode(m[1]);
    if (/^(mailto|tel|javascript):/.test(h)) continue;
    const abs = new URL(h, u);
    if (abs.host === HOST && !linked.has(abs.href)) linked.set(abs.href, u);
  }
  pages.set(u, { title, desc, noindex });
  if (bad.length) fail('page', `${path}: ${bad.join(' · ')}`);
});
pass('pages', `${pages.size} sitemap pages fetched and checked (head, JSON-LD, images, h1)`);
// titles and descriptions: one per page
for (const [k, label] of [['title', 'title'], ['desc', 'description']]) {
  const seen = new Map();
  for (const [u, p] of pages) { const v = p[k]; if (seen.has(v)) fail(`dup-${label}`, `"${v.slice(0, 50)}" on ${new URL(seen.get(v)).pathname} and ${new URL(u).pathname}`); else seen.set(v, u); }
  const lens = [...pages.values()].map((p) => p[k].length);
  pass(`${label}-unique`, `${label}s checked for duplicates (${Math.min(...lens)}–${Math.max(...lens)} chars)`);
}
// lengths: results cut a title near 60 Latin / 30 CJK characters and a description near 160 / 100. Paper pages carry the
// paper's own title, which is long by nature: those are counted, not listed.
let longPaperTitles = 0;
for (const [u, p] of pages) {
  const path = new URL(u).pathname, en = path.startsWith('/en/'), t = p.title.length, d = p.desc.length;
  if (t > (en ? 65 : 45)) { if (path.includes('/papers/')) longPaperTitles++; else warn('title-length', `${path} title ${t} chars (may be cut in results)`); }
  if (d < (en ? 70 : 30) || d > (en ? 170 : 160)) warn('desc-length', `${path} description ${d} chars (want ${en ? '70–170' : '30–160'})`);
}
if (longPaperTitles) pass('paper-titles', `${longPaperTitles} paper pages have titles longer than results show (the paper's own title; expected)`);
// every internal link answers 200 directly (a redirect is a wasted hop; a 404 is broken)
await pool([...linked.keys()], 8, async (l) => {
  const r = await get(l);
  if (r.status >= 400 || r.status === 0) fail('link', `${new URL(linked.get(l)).pathname} → ${l} ${r.status}`);
  else if (r.status >= 300) warn('link-redirect', `${new URL(linked.get(l)).pathname} → ${new URL(l).pathname} ${r.status} → ${r.headers.get('location')}`);
});
pass('links', `${linked.size} internal links followed`);
// every image (and share card) loads; share cards are 1200×630
await pool([...images.keys()], 8, async (k) => {
  const og = k.startsWith('OG '), src = og ? k.slice(3) : k;
  const r = await get(src);
  if (r.status !== 200 || !/^image\//.test(r.headers.get('content-type') ?? '')) { fail('image', `${new URL(images.get(k)).pathname} → ${src} ${r.status} ${r.headers.get('content-type')}`); return; }
  if (og) { const d = imageSize(r.buf); if (!d || d[0] < 1200 || d[1] < 600) warn('og-image-size', `${src} ${d?.join('×')} (want ≥1200×630)`); }
});
pass('images', `${images.size} images and share cards loaded`);
// noindex pages stay out of the sitemap; indexable member pages are in it
{
  const members = [...linked.keys()].filter((l) => /\/members\/[^/]+\/$/.test(new URL(l).pathname));
  for (const m of members) {
    if (pages.has(m)) continue;
    const r = await get(m);
    const ni = /noindex/i.test(meta(r.text(), 'robots') ?? '');
    if (!ni) fail('sitemap-missing', `${new URL(m).pathname} is indexable but not in the sitemap`);
  }
  pass('sitemap-coverage', `${members.length} linked member pages checked against the sitemap`);
}

const n = (l) => results.filter((r) => r.level === l).length;
console.log(`\n${n('PASS')} pass · ${n('WARN')} warn · ${n('FAIL')} fail`);
process.exit(n('FAIL') ? 1 : 0);
