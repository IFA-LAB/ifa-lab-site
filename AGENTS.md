# AGENTS.md — instructions for AI coding agents

You are helping a member of IFA Lab (NCU Information Management) edit the lab website.
Human-facing rules are in `CONTRIBUTING.md` (Traditional Chinese); this file is the same contract for you.
When the two disagree, `scripts/check-custom.mjs` is the source of truth: it is what CI runs.

## Stack

Astro 7 (static), React 19 islands, three.js 0.187 + @react-three/fiber 9, TypeScript strict.
Locales: `zh-tw` (default) and `en`, routed as `/zh-tw/...` and `/en/...`.

## What a member may change (one member per PR)

1. `src/data/members/<id>.json` — profile data. Schema: `src/content.config.ts` (`members`). Text fields are `{ "zh": "...", "en": "..." }`.
2. `src/assets/members/<id>.jpg` — square photo, ≥ 400px.
3. `src/custom/<id>/` — the member's own section. Entry file `Section.astro`, receives `{ lang: 'zh-tw' | 'en' }`. It renders on `/<lang>/members/<id>/` inside a frame with `contain: layout paint style`.

Do not edit anything else. If the request needs a change outside these paths, stop and tell the user to open an issue for the maintainers.

## Hard rules (CI fails otherwise)

- Files: `.astro .tsx .ts .css .json`, images `.webp .avif .jpg .jpeg .png .svg` (≤ 300 KB each), `.glb` (≤ 1.5 MB). Folder ≤ 2 MB.
- Budgets after build: the member page gets ≤ 80 KB gzip of extra JS compared with a member page without a custom section; page HTML ≤ 200 KB.
- No external resources at all: no `<script src="http...">`, `<iframe>`, `<link>`, `@import`, `url(http...)`. No `fetch(`, `eval(`, `new Function(`.
- Colours and fonts only through tokens: `var(--clay-blue|up|down|sun|pink|grey)`, `var(--ink)`, `var(--ink-2)`, `var(--surface)`, `var(--surface-2)`, `var(--accent)`; fonts `var(--f-body|f-display|f-mono)` via the `font:` shorthand (never `font-family:`). The only literal colours allowed are `rgb(0 0 0 / <alpha>)` and `rgb(255 255 255 / <alpha>)` for clay shading. Taiwan convention: red (`--clay-up`) means up, green (`--clay-down`) means down.
- Never `position: fixed`, `!important`, `:global(...)`, `document.body|documentElement|head`, or `location.href =`.
- Hydration only with `client:visible` or `client:idle` (never `client:load` / `client:only`).
- Imports only from: relative paths inside the member folder, `react`, `three`, `three/examples/jsm/*`, `@react-three/fiber`, `@/i18n/ui`, `@/components/three/util`, `astro:assets`, `@/data/members/<id>.json`. Do not add npm dependencies.

## Quality bar (reviewed by maintainers)

- Bilingual: every visible string has zh and en; pick by `lang`. Never show zh-only text on the English page.
- Accessibility: real `<button>`/`<a>`, targets ≥ 44×44 px, `alt` on images, visible focus, and `@media (prefers-reduced-motion: reduce)` turning off movement. For 3D use `canRun3D()` and `usePrefersReducedMotion()` from `@/components/three/util`, render a static fallback when 3D cannot run, and pause rendering off-screen (`frameloop`).
- Spacing from `var(--space-1..10)`, radius from `var(--r-sm|md|lg|full)`, motion from `var(--dur-*)` and `var(--ease-out)`.
- No private data: no phone numbers, private emails, home addresses, or photos of other people without consent.

## Definition of done

Run, in `site/`:

```sh
npm run build
```

It runs the custom-section rules, `astro check`, the build, and the page-weight budget. Done means exit code 0 and the line `✓ 自訂區塊檢查通過` after the budget step. Paste the command and the relevant output (including the `多出的 JS` line for the member) in your reply to the user. If you could not run it, say so and why; do not claim success.

Preview: `npm run dev`, then open `http://localhost:4321/zh-tw/members/<id>/` and `/en/members/<id>/`.

Start from the example: `src/custom/ju-shen-huang/Section.astro`.
