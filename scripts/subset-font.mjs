// Subset the rounded CJK display face (Huninn, OFL) to the glyphs the built site actually shows in display text.
// Why: the full font is ~4.7 MB and fontsource's unicode-range split adds ~90 KB of render-blocking CSS.
// The subset is usually 30–80 KB and its @font-face lives in src/styles/global.css (/fonts/huninn-sub.woff2).
//
//   node scripts/subset-font.mjs            after `astro build`: writes dist/fonts/huninn-sub.woff2
//   node scripts/subset-font.mjs --public   also refreshes public/fonts/huninn-sub.woff2 (used by `npm run dev`)
//
// Text that falls outside the subset still renders, in the body font, so a stale subset never breaks a page.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SRC_FONT = join(ROOT, 'scripts/fonts/Huninn-Regular.woff2');

const html = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) html.push(readFileSync(p, 'utf8'));
  }
})(DIST);

// Elements that use var(--f-display): headings, buttons, stat numbers, strong names, step numbers.
const pick = [
  /<(h[1-4]|dd|strong|summary)\b[^>]*>([\s\S]*?)<\/\1>/g,
  /<(a|button|span|p)\b[^>]*class="[^"]*\b(?:btn|name|num|go)\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g,
];
const chars = new Set();
const add = (s) => {
  const text = s.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ');
  for (const ch of text) if (ch.codePointAt(0) > 0x7f) chars.add(ch);
};
for (const h of html) for (const re of pick) for (const m of h.matchAll(re)) add(m[m.length - 1]);
// The 3D board paints area names onto a canvas; they come in as island props (JSON in the HTML).
for (const h of html) for (const m of h.matchAll(/&quot;label&quot;:\[0,&quot;([^&]*)&quot;\]/g)) add(m[1]);
// Common punctuation, so a new heading with these never mixes faces.
add('，。、：；？！「」『』（）・—…～０１２３４５６７８９');

const text = [...chars].join('') + ' 0123456789';
const out = await subsetFont(readFileSync(SRC_FONT), text, { targetFormat: 'woff2' });
mkdirSync(join(DIST, 'fonts'), { recursive: true });
writeFileSync(join(DIST, 'fonts/huninn-sub.woff2'), out);
if (process.argv.includes('--public')) {
  mkdirSync(join(ROOT, 'public/fonts'), { recursive: true });
  writeFileSync(join(ROOT, 'public/fonts/huninn-sub.woff2'), out);
}
console.log(`✓ 圓體字子集：${chars.size} 個字，${(out.length / 1024).toFixed(1)} KB`);
