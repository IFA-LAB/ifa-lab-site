// The site moved from ifa-lab.jushenhuang-jason.workers.dev to ifalab-ncu.com (2026-11-27). This Worker keeps the old
// name on the old account and sends every old link, path and query kept, to the new address.
export default {
  fetch(req: Request) {
    const u = new URL(req.url);
    return Response.redirect(`https://ifalab-ncu.com${u.pathname}${u.search}`, 301);
  },
};
