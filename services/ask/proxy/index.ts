// Forwards POST /ask and GET /health to ifa_ask.py on the Spark (127.0.0.1:8790 there, reached through the tunnel).
interface Env { SPARK: { fetch: typeof fetch } }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (!(req.method === 'POST' && pathname === '/ask') && !(req.method === 'GET' && pathname === '/health')) return new Response('not found', { status: 404 });
    try {
      const r = await env.SPARK.fetch(`http://127.0.0.1:8790${pathname}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: req.method === 'POST' ? await req.text() : undefined,
        signal: AbortSignal.timeout(70_000),
      });
      return new Response(r.body, { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    } catch (e) {
      return Response.json({ answer: '', mode: 'offline', error: String(e).slice(0, 200) }, { status: 502 });
    }
  },
};
