#!/usr/bin/env node
/**
 * Guardrails for member-built sections (src/custom/<member-id>/).
 *
 *   node scripts/check-custom.mjs            static rules (run before build)
 *   node scripts/check-custom.mjs --budget   page-weight budgets (run after `astro build`)
 *   BASE_REF=origin/main node scripts/check-custom.mjs --scope
 *                                            PR scope: a PR may only touch one member's own files
 *
 * Every rule is written up for humans and AI agents in CONTRIBUTING.md. Keep the two in sync.
 * Exit code 1 on any violation; each message names the file, the rule and how to fix it.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, posix } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CUSTOM = join(ROOT, 'src/custom');
const MEMBERS = join(ROOT, 'src/data/members');
const errors = [];
const fail = (file, rule, fix) => errors.push(`✗ ${file}\n    規則 ${rule}\n    怎麼修：${fix}`);

const KB = 1024;
export const LIMITS = {
  image: 300 * KB,         // each .webp/.avif/.jpg/.png/.svg
  model: 1536 * KB,        // each .glb
  folder: 2048 * KB,       // whole src/custom/<id>/
  pageJsGzipExtra: 80 * KB, // extra JS on your member page vs. a page without a custom section
  pageHtml: 200 * KB,      // the member page's HTML
};
const EXT = {
  code: ['.astro', '.tsx', '.ts', '.css'],
  image: ['.webp', '.avif', '.jpg', '.jpeg', '.png', '.svg'],
  model: ['.glb'],
  data: ['.json'],
};
const ALLOWED_IMPORTS = [
  /^\.\.?\//,                       // your own folder
  /^@\/i18n\/ui$/,
  /^@\/components\/three\/util$/,
  /^@\/data\/members\/[\w-]+\.json$/,
  /^astro:assets$/,
  /^react$/, /^react\/jsx-runtime$/,
  /^three$/, /^three\/examples\/jsm\/.+$/,
  /^@react-three\/fiber$/,
];
const FORBIDDEN = [
  [/<script[^>]+src=["']https?:/i, 'R4 不載入外部 script', '把程式碼放進你的資料夾，用 import 引入。'],
  [/<iframe/i, 'R4 不嵌入 iframe', '改成一個連結，或做成截圖。'],
  [/<link\b/i, 'R4 不用 <link> 載入外部資源', '樣式寫在 <style> 裡。'],
  [/@import\b/, 'R4 不用 @import', '樣式直接寫在元件的 <style> 裡。'],
  [/url\(\s*["']?https?:/i, 'R4 不從外部網址載入圖片或字型', '把檔案放進你的資料夾再引用。'],
  [/\bfetch\s*\(/, 'R4 不在執行時連網（fetch）', '資料在建置時寫進檔案；需要即時資料先找維護者討論。'],
  [/font-family\s*:/i, 'R5 字型只用網站的 token', '用 var(--f-body)／var(--f-display)／var(--f-mono)，用 font: … var(--f-body) 的寫法。'],
  [/position\s*:\s*fixed/i, 'R6 不用 position: fixed', '區塊不能蓋住網站的頁首或其他內容；改用 absolute 或 sticky。'],
  [/!important/, 'R6 不用 !important', '提高選擇器的具體程度，或把樣式寫在元件裡。'],
  [/:global\(/, 'R6 不寫 :global() 樣式', 'Astro 的樣式預設只作用在你的元件；別去改網站其他地方。'],
  [/document\.(body|documentElement|head)\b/, 'R6 不改動整個頁面', '只操作你自己元件裡的元素（用 ref）。'],
  [/\beval\s*\(|new Function\s*\(/, 'R4 不用 eval／new Function', '直接寫程式碼。'],
  [/client:(load|only)\b/, 'R7 互動元件只用 client:visible 或 client:idle', '把 client:load／client:only 改成 client:visible，避免拖慢首頁載入。'],
  [/window\.location\s*=|location\.href\s*=/, 'R6 不自動跳頁', '用一般的 <a href> 連結。'],
];
// Raw colours are not allowed; the clay highlight/shadow pair is the one exception (used by every clay block).
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g;
const COLOR_OK = /rgb\(\s*(?:0 0 0|255 255 255)\s*\/\s*0?\.\d+\s*\)/g;

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function checkStatic() {
  if (!existsSync(CUSTOM)) return;
  const memberIds = new Set(readdirSync(MEMBERS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
  for (const id of readdirSync(CUSTOM)) {
    const dir = join(CUSTOM, id);
    if (!statSync(dir).isDirectory()) { fail(`src/custom/${id}`, 'R1 src/custom/ 底下只放資料夾', '移到 src/custom/<你的 id>/ 裡。'); continue; }
    if (!memberIds.has(id)) fail(`src/custom/${id}/`, 'R1 資料夾名稱必須是你的成員 id', `成員 id 就是 src/data/members/ 底下你的檔名（不含 .json），例如 ${[...memberIds][0]}。`);
    if (!existsSync(join(dir, 'Section.astro'))) fail(`src/custom/${id}/`, 'R1 入口檔必須叫 Section.astro', '複製 src/custom/ju-shen-huang/Section.astro 當起點。');
    let total = 0;
    for (const file of walk(dir)) {
      const rel = posix.join('src/custom', relative(CUSTOM, file).split('\\').join('/'));
      const ext = extname(file).toLowerCase();
      const size = statSync(file).size;
      total += size;
      const all = [...EXT.code, ...EXT.image, ...EXT.model, ...EXT.data];
      if (!all.includes(ext)) { fail(rel, `R2 不接受 ${ext || '無副檔名'} 檔案`, `只接受 ${all.join(' ')}。影片請上傳到 YouTube 再放連結。`); continue; }
      if (EXT.image.includes(ext) && size > LIMITS.image) fail(rel, `R3 圖片每張 ≤ ${LIMITS.image / KB} KB（現在 ${Math.round(size / KB)} KB）`, '轉成 WebP 或 AVIF、寬度縮到 1600px 以內，例如 npx @squoosh/cli --webp auto。');
      if (EXT.model.includes(ext) && size > LIMITS.model) fail(rel, `R3 3D 模型每個 ≤ ${LIMITS.model / KB} KB（現在 ${Math.round(size / KB)} KB）`, '在 Blender 減面（Decimate），匯出 glTF 時勾 Draco 壓縮。');
      if (!EXT.code.includes(ext)) continue;
      const src = readFileSync(file, 'utf8');
      for (const [re, rule, fix] of FORBIDDEN) if (re.test(src)) fail(rel, rule, fix);
      const colours = (src.replace(COLOR_OK, '').match(RAW_COLOR) ?? []).filter((c) => !/^#\d+$/.test(c) || c.length > 4);
      if (ext !== '.ts' && colours.length) fail(rel, `R5 顏色只用網站的 token（找到 ${[...new Set(colours)].slice(0, 3).join(' ')}）`, '用 var(--clay-blue／up／down／sun／pink／grey)、var(--ink)、var(--ink-2)、var(--surface)、var(--surface-2)、var(--accent)。深淺主題會自動切換。');
      for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
        if (!ALLOWED_IMPORTS.some((re) => re.test(m[1]))) fail(rel, `R8 不能 import「${m[1]}」`, '只能引用你自己的資料夾、three、@react-three/fiber、react、@/i18n/ui、@/components/three/util、astro:assets。需要別的套件先開 issue 找維護者。');
      }
    }
    if (total > LIMITS.folder) fail(`src/custom/${id}/`, `R3 整個資料夾 ≤ ${LIMITS.folder / KB} KB（現在 ${Math.round(total / KB)} KB）`, '壓縮圖片和模型，或刪掉沒用到的檔案。');
  }
}

/** PR scope: compare with BASE_REF and make sure only one member's own files changed. */
function checkScope() {
  const base = process.env.BASE_REF;
  if (!base) { console.log('（沒有 BASE_REF，略過 PR 範圍檢查）'); return; }
  const changed = execSync(`git diff --name-only ${base}...HEAD`, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    .map((f) => f.replace(/^site\//, ''));
  const owners = new Set();
  for (const f of changed) {
    const m = f.match(/^src\/custom\/([\w-]+)\//) ?? f.match(/^src\/data\/members\/([\w-]+)\.json$/) ?? f.match(/^src\/assets\/members\/([\w-]+)\.\w+$/);
    if (m) owners.add(m[1]);
    else if (process.env.ALLOW_CORE !== '1') fail(f, 'R9 成員的 PR 只能改自己的檔案', '自己的檔案是 src/custom/<id>/、src/data/members/<id>.json、src/assets/members/<id>.*；網站本體的修改請另開 PR，由維護者加上 core 標籤。');
  }
  if (owners.size > 1 && process.env.ALLOW_CORE !== '1') fail([...owners].join(', '), 'R9 一個 PR 只改一位成員', '拆成每人一個 PR。');
}

/** After build: HTML size and extra JS that a member's custom section adds to their page. */
function checkBudget() {
  const dist = join(ROOT, 'dist');
  if (!existsSync(dist)) { fail('dist/', '要先建置', '先跑 npm run build。'); return; }
  const gz = new Map();
  const jsGzip = (url, seen = new Set()) => {
    if (seen.has(url)) return 0;
    seen.add(url);
    const p = join(dist, url);
    if (!existsSync(p)) return 0;
    const code = readFileSync(p);
    if (!gz.has(url)) gz.set(url, gzipSync(code).length);
    let sum = gz.get(url);
    for (const m of code.toString().matchAll(/(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g)) sum += jsGzip(posix.join(posix.dirname(url), m[1]), seen);
    return sum;
  };
  const pageJs = (html) => {
    const seen = new Set();
    let sum = 0;
    for (const m of html.matchAll(/(?:component-url|renderer-url|src)="(\/_astro\/[^"]+\.js)"/g)) sum += jsGzip(m[1], seen);
    for (const m of html.matchAll(/import\s*["'](\/_astro\/[^"']+\.js)["']/g)) sum += jsGzip(m[1], seen);
    return sum;
  };
  const ids = existsSync(CUSTOM) ? readdirSync(CUSTOM) : [];
  const allIds = readdirSync(MEMBERS).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const plain = allIds.find((id) => !ids.includes(id));
  for (const lang of ['zh-tw', 'en']) {
    const read = (id) => readFileSync(join(dist, lang, 'members', id, 'index.html'), 'utf8');
    const baseline = plain ? pageJs(read(plain)) : 0;
    for (const id of ids) {
      const f = join(dist, lang, 'members', id, 'index.html');
      if (!existsSync(f)) continue;
      const html = read(id);
      const rel = `dist/${lang}/members/${id}/`;
      if (html.length > LIMITS.pageHtml) fail(rel, `R3 頁面 HTML ≤ ${LIMITS.pageHtml / KB} KB（現在 ${Math.round(html.length / KB)} KB）`, '文字太多或把大量資料寫進了 HTML；資料放 JSON、圖片用 <Image>。');
      const extra = pageJs(html) - baseline;
      if (extra > LIMITS.pageJsGzipExtra) fail(rel, `R3 你的區塊多出的 JS ≤ ${LIMITS.pageJsGzipExtra / KB} KB gzip（現在多 ${Math.round(extra / KB)} KB）`, '少用互動元件；3D 請用 three 而不是整包 drei；能用 CSS 做的就別用 JS。');
      else console.log(`  ${rel} 多出的 JS：${Math.round(extra / KB)} KB gzip（上限 ${LIMITS.pageJsGzipExtra / KB}）`);
    }
  }
}

const args = process.argv.slice(2);
if (args.includes('--scope')) checkScope();
else if (args.includes('--budget')) checkBudget();
else checkStatic();

if (errors.length) {
  console.error(`\n自訂區塊檢查沒過，共 ${errors.length} 項：\n\n${errors.join('\n\n')}\n\n規則全文：CONTRIBUTING.md`);
  process.exit(1);
}
console.log('✓ 自訂區塊檢查通過');
