import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { lab, advisor, areas } from '@/data/lab';

/** llms.txt: a plain summary for AI assistants, built from the same data as the site. */
export const GET: APIRoute = async ({ site }) => {
  const u = (p: string) => new URL(p, site).href;
  const members = (await getCollection('members')).sort((a, b) => a.data.cohort - b.data.cohort || a.data.order - b.data.order);
  const pubs = (await getCollection('publications')).sort((a, b) => b.data.year - a.data.year);
  const theses = await getCollection('theses');
  const lines = [
    `# ${lab.short} — ${lab.name.en}（${lab.name.zh}）`,
    '',
    `> ${lab.mission[0].en}`,
    '',
    `- Department: ${lab.dept.en}`,
    `- Advisor: ${advisor.name.en}（${advisor.name.zh}）, ${advisor.title.en}`,
    `- Founded: August 2023`,
    `- Contact: ${lab.contact.email}; ${lab.contact.room.en}`,
    `- Research areas: ${areas.map((a) => a.name.en).join('; ')}`,
    '',
    '## Pages',
    `- [Home](${u('/en/')}) / [中文](${u('/zh-tw/')})`,
    `- [Research](${u('/en/research/')}): journal articles, working papers, theses, NSTC projects`,
    `- [Members](${u('/en/members/')}): members by cohort`,
    `- [Advisor](${u('/en/advisor/')})`,
    `- [Join Us](${u('/en/join/')})`,
    '',
    '## Members',
    ...members.map((m) => {
      const th = theses.find((x) => x.data.member === m.id);
      return `- [${m.data.name.en ?? m.data.name.zh}（${m.data.name.zh}）](${u(`/en/members/${m.id}/`)}): cohort ${m.data.cohort}${m.data.status === 'graduated' ? ', alumni' : ''}${th ? `; thesis: ${th.data.title.en ?? th.data.title.zh}` : ''}`;
    }),
    '',
    '## Publications',
    ...pubs.map((p) => `- ${p.data.authors.join(', ')} (${p.data.year}${p.data.status === 'forthcoming' ? ', forthcoming' : ''}). ${p.data.title}.${p.data.venue ? ` ${p.data.venue}.` : ' Working paper.'}${p.data.doi ? ` https://doi.org/${p.data.doi}` : ''}`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
