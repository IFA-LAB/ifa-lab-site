// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Production URL is a placeholder until the department subdomain is assigned.
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
      filter: (page) => new URL(page).pathname !== '/',
      i18n: { defaultLocale: 'zh-tw', locales: { 'zh-tw': 'zh-Hant-TW', en: 'en' } },
    }),
  ],
});
