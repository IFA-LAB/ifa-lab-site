// www.ifalab-ncu.com → ifalab-ncu.com, same path and query: one address for every page (search engines, shared links).
export default {
  fetch(req: Request) {
    const u = new URL(req.url);
    u.hostname = 'ifalab-ncu.com';
    return Response.redirect(u.toString(), 301);
  },
};
