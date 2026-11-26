import { getCollection } from 'astro:content';
import { t, href, type Bi, type Locale } from '@/i18n/ui';
import { areas } from '@/data/lab';

/** The lab's timeline, built from the data files (so it grows as members add data) plus a few hand-written milestones.
    Used by the history page and the "latest" row on the home page. */
export type Kind = 'milestone' | 'paper' | 'grant' | 'thesis' | 'award';
export type Event = { date: string; kind: Kind; text: Bi; link?: string; who?: string[]; photo?: 'ched'; /** clay colour of the research area (papers, theses) */ clay?: string };

const clayOf = (area?: string) => areas.find((a) => a.key === area)?.clay;

export async function labEvents(lang: Locale): Promise<Event[]> {
  const members = await getCollection('members');
  const founders = members.filter((m) => m.data.founder).sort((a, b) => a.data.cohort - b.data.cohort || a.data.order - b.data.order);
  const theses = await getCollection('theses');
  const grants = await getCollection('grants');
  const pubs = await getCollection('publications');
  /** The lab's story starts here; earlier items belong to the advisor's own record. */
  const START = '2023-02';
  const THIS_YEAR = String(new Date().getFullYear());

  // 1. Hand-written milestones: things no data file records.
  const milestones: Event[] = [
    { date: '2023-02', kind: 'milestone', text: { zh: '邱信瑜老師到中央大學資訊管理學系任教。', en: 'Prof. Hsin-Yu Chiu joins NCU Information Management.' } },
    { date: '2023-08', kind: 'milestone', text: { zh: 'IFA Lab 在志希館 712 室成立。', en: 'IFA Lab was founded in Room 712, Zhixi Building.' }, who: founders.map((m) => m.id) },
    { date: '2024-10', kind: 'award', text: { zh: 'Ched.AI（財報分析與徵信風險評估）獲國科會 GenAI Stars 創意創客組優選。', en: 'Ched.AI (financial-statement analysis and credit-risk assessment) wins a Merit Award at NSTC GenAI Stars.' }, who: ['yun-cheng-chiang', 'dao-en-liu', 'chia-en-tsai', 'ju-shen-huang'], link: href(lang, 'research#s-h'), photo: 'ched' },
  ];

  // 2. The rest comes from the data files, so the history grows when members add data.
  const fromGrants: Event[] = grants
    .map((g) => ({ g, date: g.data.period.slice(0, 7).replace('/', '-') }))
    .filter(({ date }) => date >= START)
    .map(({ g, date }) => ({
      date,
      kind: 'grant' as const,
      text: { zh: `${t(g.data.kind, 'zh-tw')}開始：${t(g.data.title, 'zh-tw')}`, en: `${t(g.data.kind, 'en')} started: ${t(g.data.title, 'en')}` },
      who: members.filter((m) => m.data.name.en === g.data.pi).map((m) => m.id),
    }));

  const fromPubs: Event[] = pubs
    .filter((p) => p.data.kind === 'journal' && String(p.data.year) >= START.slice(0, 4))
    .map((p) => {
      const future = p.data.status === 'forthcoming';
      return {
        date: future ? THIS_YEAR : String(p.data.year),
        kind: 'paper' as const,
        clay: clayOf(p.data.area),
        text: future
          ? { zh: `獲 ${p.data.venue} 接受，預計 ${p.data.year} 年刊登：〈${p.data.title}〉`, en: `Accepted by ${p.data.venue}, to appear in ${p.data.year}: “${p.data.title}”` }
          : { zh: `〈${p.data.title}〉刊登於 ${p.data.venue}。`, en: `Published in ${p.data.venue}: “${p.data.title}”` },
        link: href(lang, `papers/${p.id}`),
        who: members.filter((m) => m.data.name.en && p.data.authors.includes(m.data.name.en)).map((m) => m.id),
      };
    });

  const fromTheses: Event[] = theses.map((x) => ({
    date: `${x.data.academicYear + 1912}-07`,
    kind: 'thesis' as const,
    clay: clayOf(x.data.area),
    text: { zh: `完成碩士論文〈${x.data.title.zh}〉。`, en: `Completed a master’s thesis: “${x.data.title.en ?? x.data.title.zh}”` },
    who: [x.data.member],
  }));

  // Member awards carry a year in the text. Ched.AI is covered by the milestone above.
  const fromAwards: Event[] = members.flatMap((m) =>
    m.data.awards
      .filter((a) => !/Ched\.AI|發表|助理|研究計畫/.test(a.zh))
      .map((a) => ({ a, year: a.zh.match(/\b(20\d\d)\b/)?.[1] }))
      .filter((x): x is { a: Bi; year: string } => !!x.year && x.year >= START.slice(0, 4))
      .map(({ a, year }) => ({ date: year, kind: 'award' as const, text: a, who: [m.id] })),
  );

  return [...milestones, ...fromGrants, ...fromPubs, ...fromTheses, ...fromAwards];
}

/** Newest first: month-dated events before year-only ones of the same year. */
export const newestFirst = (a: Event, b: Event) => b.date.slice(0, 4).localeCompare(a.date.slice(0, 4)) || (a.date.length === 4 ? 1 : 0) - (b.date.length === 4 ? 1 : 0) || b.date.localeCompare(a.date);
