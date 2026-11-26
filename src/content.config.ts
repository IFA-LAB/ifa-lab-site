import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

/** Bilingual text. `en` may be missing; the site then falls back to `zh` and marks it. */
const L = z.object({ zh: z.string().min(1), en: z.string().min(1).optional() });

/** Clay palette names. Members may only pick from these (contrast pre-checked). */
export const CLAY = ['blue', 'up', 'down', 'sun', 'pink', 'grey', 'violet'] as const;

const members = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/members' }),
  schema: ({ image }) => z.object({
    name: L,
    cohort: z.number().int().min(1).max(4),
    order: z.number().int(),
    degree: z.enum(['master', 'bachelor']).optional(),
    status: z.enum(['enrolled', 'graduated']),
    /** Shown as-is under the name; keep it short. */
    headline: L.optional(),
    /** Graduates: where they went after the lab (employer or school), shown on the card and the profile. */
    now: L.optional(),
    founder: z.boolean().default(false),
    /** 'lab' = maintained by site maintainers (graduates / placeholders); 'self' = member edits it. */
    maintainedBy: z.enum(['self', 'lab']),
    placeholder: z.boolean().default(false),
    bio: L.optional(),
    education: z
      .array(z.object({ school: L, degree: L, period: z.string() }))
      .default([]),
    experience: z
      .array(z.object({ title: L, org: L, period: z.string() }))
      .default([]),
    projects: z
      .array(z.object({ name: z.string(), year: z.string(), desc: L, url: z.url().optional() }))
      .default([]),
    awards: z.array(L).default([]),
    research: z.array(z.string()).default([]),
    interests: z.array(L).default([]),
    thesis: z.string().optional(),
    links: z
      .object({
        schoolEmail: z.email().optional(),
        github: z.url().optional(),
        linkedin: z.url().optional(),
        website: z.url().optional(),
      })
      .default({}),
    /** Square portrait in src/assets/members/, at least 400px (checked when the member page builds). Converted to AVIF/WebP. */
    photo: image().optional(),
    figure: z
      .object({
        clay: z.enum(CLAY).default('grey'),
        accessory: z.enum(['none', 'cat', 'phones', 'glasses', 'guitar']).default('none'),
        /** Optional whole-figure design instead of the gumdrop; ask the maintainers to add a new one. */
        model: z.enum(['matcha-latte']).optional(),
      })
      .default({ clay: 'grey', accessory: 'none' }),
  }),
});

const publications = defineCollection({
  loader: file('./src/data/publications.json'),
  schema: z.object({
    kind: z.enum(['journal', 'working']),
    year: z.number().int(),
    status: z.enum(['published', 'forthcoming', 'working']),
    title: z.string(),
    authors: z.array(z.string()).min(1),
    /** Index in `authors` of the corresponding author(s). */
    corresponding: z.array(z.number().int()).default([]),
    venue: z.string().optional(),
    volume: z.string().optional(),
    pages: z.string().optional(),
    doi: z.string().optional(),
    /** Link when the paper has no DOI (publisher page, notebook). */
    url: z.url().optional(),
    /** Public slide deck for the paper. */
    slides: z.url().optional(),
    tags: z.array(z.string()).default([]),
    area: z.enum(['empirical', 'behavioral', 'pricing', 'ai', 'forecast', 'apps']),
    plain: L.optional(),
  }),
});

const theses = defineCollection({
  loader: file('./src/data/theses.json'),
  schema: z.object({
    member: z.string(),
    academicYear: z.number().int(),
    title: L,
    fullTextFrom: z.string().optional(),
    area: z.enum(['empirical', 'behavioral', 'pricing', 'ai', 'forecast', 'apps']),
  }),
});

const grants = defineCollection({
  loader: file('./src/data/grants.json'),
  schema: z.object({
    title: L,
    period: z.string(),
    kind: L,
    pi: z.string(),
    url: z.url().optional(),
  }),
});

export const collections = { members, publications, theses, grants };
