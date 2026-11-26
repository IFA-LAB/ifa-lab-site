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
export function citation(p: Publication['data']) {
  const year = p.status === 'forthcoming' ? `${p.year}, forthcoming` : String(p.year);
  const tail = [p.venue, p.volume, p.pages].filter(Boolean).join(', ');
  const link = p.doi ? ` https://doi.org/${p.doi}` : p.url ? ` ${p.url}` : '';
  return `${p.authors.join(', ')} (${year}). ${p.title}.${tail ? ` ${tail}.` : p.kind === 'working' ? ' Working paper.' : ''}${link}`;
}

/** BibTeX entry; key = first author's surname + year + first title word. */
export function bibtex(id: string, p: Publication['data']) {
  const surname = (p.authors[0].split(' ').pop() ?? 'anon').toLowerCase();
  const word = (p.title.match(/[A-Za-z]+/)?.[0] ?? '').toLowerCase();
  const f: [string, string | undefined][] = [
    ['title', p.title],
    ['author', p.authors.join(' and ')],
    ['year', String(p.year)],
    [p.kind === 'journal' ? 'journal' : 'note', p.kind === 'journal' ? p.venue : 'Working paper'],
    ['volume', p.volume],
    ['pages', p.pages?.replace('–', '--')],
    ['doi', p.doi],
    ['url', p.doi ? undefined : p.url],
  ];
  const body = f.filter(([, v]) => v).map(([k, v]) => `  ${k} = {${v}}`).join(',\n');
  return `@${p.kind === 'journal' ? 'article' : 'unpublished'}{${surname}${p.year}${word},\n${body}\n}`;
}

export const paperPaths = async () => {
  const all = await getCollection('publications');
  return locales.flatMap((lang) => all.map((p) => ({ params: { lang, id: p.id }, props: { paper: p } })));
};
