import { getCollection, type CollectionEntry } from 'astro:content';
import { locales, type Locale } from '@/i18n/ui';

export type Member = CollectionEntry<'members'>;
export type Publication = CollectionEntry<'publications'>;

export const langPaths = () => locales.map((lang) => ({ params: { lang } }));

export async function membersByCohort() {
  const all = await getCollection('members');
  const cohorts = new Map<number, Member[]>();
  for (const m of all.sort((a, b) => a.data.cohort - b.data.cohort || a.data.order - b.data.order)) {
    cohorts.set(m.data.cohort, [...(cohorts.get(m.data.cohort) ?? []), m]);
  }
  return [...cohorts.entries()];
}

export async function publications() {
  const all = await getCollection('publications');
  return all.sort((a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title));
}

/** Match author display names on publications to member pages (English names). */
export async function memberByEnglishName() {
  const all = await getCollection('members');
  return new Map(all.filter((m) => m.data.name.en).map((m) => [m.data.name.en!, m.id]));
}

export function apa(p: Publication['data'], lang: Locale) {
  const authors = p.authors.map((a, i) => (p.corresponding.includes(i) ? `${a}*` : a)).join(', ');
  const tail = [p.venue, p.volume, p.pages].filter(Boolean).join(', ');
  const year = p.status === 'forthcoming' ? (lang === 'en' ? `${p.year}, forthcoming` : `${p.year}，即將刊登`) : String(p.year);
  return { authors, year, tail };
}

export const isLocale = (v: string | undefined): v is Locale => (locales as readonly string[]).includes(v ?? '');

/** One-line citation (APA-like) for copy-to-clipboard. */
/** "Chao-Jung Chen" -> "Chen, C.-J." (APA: surname, then initials; hyphenated given names keep the hyphen). */
function apaName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  const surname = parts.pop()!;
  const initials = parts.map((g) => g.split('-').map((x) => `${x[0]}.`).join('-')).join(' ');
  return `${surname}, ${initials}`;
}

export function citation(p: Publication['data']) {
  const year = p.status === 'forthcoming' ? 'in press' : String(p.year);
  const names = p.authors.map(apaName);
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  const tail = [p.venue, p.volume, p.pages].filter(Boolean).join(', ');
  const link = p.doi ? ` https://doi.org/${p.doi}` : p.url ? ` ${p.url}` : '';
  const repo = p.doi?.startsWith('10.5281/') ? ' Zenodo.' : '';
  return p.kind === 'working' && !tail
    ? `${who} (${year}). ${p.title} [Working paper].${repo}${link}`
    : `${who} (${year}). ${p.title}.${tail ? ` ${tail}.` : ''}${link}`;
}

/** BibTeX entry; key = first author's surname + year + first title word. */
export function bibtex(id: string, p: Publication['data']) {
  const surname = (p.authors[0].split(' ').pop() ?? 'anon').toLowerCase();
  const word = (p.title.match(/[A-Za-z]+/)?.[0] ?? '').toLowerCase();
  // braces keep acronyms (EUA, PDE, LLMs, ESG) from being lower-cased by bibliography styles
  const title = p.title.replace(/\b([A-Z]*[A-Z][A-Za-z]*[A-Z][A-Za-z]*|[A-Z]{2,}s?)\b/g, '{$1}');
  const repo = p.doi?.startsWith('10.5281/') ? 'Zenodo' : undefined;
  const f: [string, string | undefined][] = [
    ['title', title],
    ['author', p.authors.join(' and ')],
    ['year', String(p.year)],
    [p.kind === 'journal' ? 'journal' : 'note', p.kind === 'journal' ? p.venue : 'Working paper'],
    ['volume', p.volume],
    ['pages', p.pages?.replace('–', '--')],
    ['publisher', p.kind === 'journal' ? undefined : repo],
    ['doi', p.doi],
    ['url', p.doi ? undefined : p.url],
  ];
  const body = f.filter(([, v]) => v).map(([k, v]) => `  ${k} = {${v}}`).join(',\n');
  return `@${p.kind === 'journal' ? 'article' : 'misc'}{${surname}${p.year}${word},\n${body}\n}`;
}

export const paperPaths = async () => {
  const all = await getCollection('publications');
  return locales.flatMap((lang) => all.map((p) => ({ params: { lang, id: p.id }, props: { paper: p } })));
};
