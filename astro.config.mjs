// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

// members whose profile is still empty: their pages are noindex, so they stay out of the sitemap too
const dir = new URL('./src/data/members/', import.meta.url);
const empty = readdirSync(dir).filter((f) => f.endsWith('.json') && JSON.parse(readFileSync(new URL(f, dir), 'utf8')).placeholder).map((f) => f.slice(0, -5));

export default defineConfig({
  site: 'https://ifalab-ncu.com',
  trailingSlash: 'always',
  i18n: {
    locales: ['zh-tw', 'en'],
    defaultLocale: 'zh-tw',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  integrations: [
    react(),
    sitemap({
      // the root only sends visitors to /zh-tw/ (noindex), so it stays out of the sitemap
      // and so do empty profiles (noindex until the member fills them in)
      filter: (page) => { const p = new URL(page).pathname; return p !== '/' && !empty.some((id) => p.endsWith(`/members/${id}/`)); },
      i18n: { defaultLocale: 'zh-tw', locales: { 'zh-tw': 'zh-Hant-TW', en: 'en' } },
    }),
  ],
});
