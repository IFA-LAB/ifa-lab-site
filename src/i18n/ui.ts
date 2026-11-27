export const locales = ['zh-tw', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh-tw';

/** Bilingual text. `en` may be missing; `t()` falls back to Chinese. */
export type Bi = { zh: string; en?: string };

export const htmlLang: Record<Locale, string> = { 'zh-tw': 'zh-Hant-TW', en: 'en' };
export const ogLocale: Record<Locale, string> = { 'zh-tw': 'zh_TW', en: 'en_US' };

/** Pick the right language; `fallback` is true when English was missing and Chinese is shown. */
export function pick(text: Bi | undefined, lang: Locale): { text: string; fallback: boolean } {
  if (!text) return { text: '', fallback: false };
  if (lang === 'en') return text.en ? { text: text.en, fallback: false } : { text: text.zh, fallback: true };
  return { text: text.zh, fallback: false };
}
export const t = (text: Bi | undefined, lang: Locale) => pick(text, lang).text;

export const ui = {
  nav: {
    home: { zh: '首頁', en: 'Home' },
    research: { zh: '研究', en: 'Research' },
    members: { zh: '成員', en: 'Members' },
    advisor: { zh: '指導教授', en: 'Advisor' },
    join: { zh: '加入我們', en: 'Join us' },
    collaboration: { zh: '合作', en: 'Collaboration' },
    history: { zh: '沿革', en: 'History' },
  },
  skip: { zh: '跳到主要內容', en: 'Skip to content' },
  langSwitch: { zh: 'English', en: '中文' },
  langSwitchLabel: { zh: 'English（切換為英文）', en: '中文 (switch to Chinese)' },
  theme: { zh: '深色模式', en: 'Dark mode' },
  menu: { zh: '選單', en: 'Menu' },
  cohort: (n: number): Bi => {
    const zh = ['一', '二', '三', '四', '五', '六'][n - 1] ?? String(n);
    return { zh: `第${zh}屆研究生`, en: `Cohort ${n}` };
  },
  graduated: { zh: '已畢業', en: 'Alum' },
  founder: { zh: '創始成員', en: 'Founding member' },
  placeholderNote: { zh: '資料準備中', en: 'Profile coming soon' },
  fallbackNote: { zh: '', en: 'Shown in Chinese until an English version is added.' },
  sections: {
    bio: { zh: '簡介', en: 'About' },
    education: { zh: '學歷', en: 'Education' },
    experience: { zh: '經歷', en: 'Experience' },
    projects: { zh: '專案', en: 'Projects' },
    awards: { zh: '獲獎與發表', en: 'Awards and talks' },
    research: { zh: '研究興趣', en: 'Research interests' },
    interests: { zh: '個人興趣', en: 'Personal interests' },
    thesis: { zh: '碩士論文', en: "Master's thesis" },
    links: { zh: '連結', en: 'Links' },
  },
  pubs: {
    journal: { zh: '期刊論文', en: 'Journal papers' },
    working: { zh: '工作論文', en: 'Working papers' },
    grants: { zh: '國科會計畫', en: 'NSTC grants' },
    theses: { zh: '碩士論文', en: "Master's theses" },
    projects: { zh: '學生專案', en: 'Student projects' },
    forthcoming: { zh: '即將刊登', en: 'forthcoming' },
    corresponding: { zh: '通訊作者', en: 'corresponding author' },
    fullTextFrom: { zh: '全文公開日', en: 'Full text from' },
    pi: { zh: '主持人', en: 'PI' },
  },
  footer: {
    contact: { zh: '聯絡我們', en: 'Contact' },
    updated: { zh: '最後更新', en: 'Last updated' },
  },
} as const;

/** Path helpers. All internal links go through `href()` so both locales stay in sync. */
export function href(lang: Locale, path = '') {
  const [p, hash] = path.split('#');
  const clean = p.replace(/^\/+|\/+$/g, '');
  return `/${lang}/${clean ? clean + '/' : ''}${hash ? '#' + hash : ''}`;
}
export function swapLocale(pathname: string, to: Locale) {
  // a 404 page has no counterpart: the switch goes to the other language's home page
  if (/\/404(\.html|\/)?$/.test(pathname)) return `/${to}/`;
  const parts = pathname.split('/');
  if ((locales as readonly string[]).includes(parts[1] ?? '')) parts[1] = to;
  return parts.join('/') || `/${to}/`;
}
export const otherLocale = (lang: Locale): Locale => (lang === 'zh-tw' ? 'en' : 'zh-tw');
