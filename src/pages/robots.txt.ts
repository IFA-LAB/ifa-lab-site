import type { APIRoute } from 'astro';

// AI crawlers are allowed on purpose: the lab wants its research to be cited by AI search (GEO).
export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      '',
      ...['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Amazonbot', 'Meta-ExternalAgent', 'Bytespider', 'cohere-ai'].flatMap((b) => [`User-agent: ${b}`, 'Allow: /', '']),
      `Sitemap: ${new URL('/sitemap-index.xml', site).href}`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
