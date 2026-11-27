// After `astro build`: Astro writes src/pages/en/404.astro to dist/en/404/index.html, but Cloudflare's
// not_found_handling "404-page" serves the nearest 404.html up the path. Move it to dist/en/404.html so a
// missing URL under /en/ gets the English page; everything else keeps dist/404.html (Chinese).
import { renameSync, rmSync, existsSync } from 'node:fs';
const from = new URL('../dist/en/404/index.html', import.meta.url);
if (existsSync(from)) {
  renameSync(from, new URL('../dist/en/404.html', import.meta.url));
  rmSync(new URL('../dist/en/404/', import.meta.url), { recursive: true });
  console.log('✓ 英文 404：dist/en/404.html');
}
