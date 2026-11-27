/**
 * 黃鉅燊's own section: everything it shows, in one place.
 * Sources: src/data/members/ju-shen-huang.json and the public work pages on ogmatcha.com (figures as stated there, 2026-11).
 */
export type Bi = { zh: string; en: string };
/** grey = a role, violet = research, blue = a product, sun = an award, up = a national first prize (gets a cup). */
export type Kind = 'role' | 'research' | 'work' | 'award' | 'win';
export type Item = { id: string; kind: Kind; text: Bi; href?: string };
export type Year = { year: string; note: Bi; items: Item[] };

export const KINDS: Record<Kind, { clay: string; name: Bi }> = {
  role: { clay: 'grey', name: { zh: '角色', en: 'Role' } },
  research: { clay: 'violet', name: { zh: '研究', en: 'Research' } },
  work: { clay: 'blue', name: { zh: '作品', en: 'Product' } },
  award: { clay: 'sun', name: { zh: '獲獎', en: 'Award' } },
  win: { clay: 'up', name: { zh: '全國首獎', en: 'National first prize' } },
};

const W = 'https://ogmatcha.com/work/';

/** Oldest first; each year's candle stands on the top of the year before, so the chart climbs like a rising K line. */
export const YEARS: Year[] = [
  {
    year: '2022', note: { zh: '進中央資管', en: 'Starting at NCU' },
    items: [
      { id: 'bs', kind: 'role', text: { zh: '進入中央大學資訊管理學系', en: 'B.S. in Information Management begins, NCU' } },
      { id: 'sap', kind: 'role', text: { zh: '加入中央大學 SAP 學生團隊，後來當暑期講師', en: 'Joins the NCU SAP Student Team, later a summer instructor' } },
    ],
  },
  {
    year: '2023', note: { zh: '進研究室', en: 'Into the lab' },
    items: [
      { id: 'ra', kind: 'role', text: { zh: '在邱信瑜老師的研究計畫當研究助理', en: 'Research assistant on Prof. Hsin-Yu Chiu’s projects' } },
      { id: 'freshweb', kind: 'role', text: { zh: '中大新生網 2024 副執行長，帶 4 組 30 人', en: 'Deputy leader of NCU Fresh Web 2024: 4 teams, 30 people' } },
    ],
  },
  {
    year: '2024', note: { zh: '創業，拿下三座首獎', en: 'A company and three first prizes' },
    items: [
      { id: 'finctory', kind: 'role', text: { zh: '共同創辦斐闊 Finctory，擔任技術長', en: 'Co-founds Finctory as CTO' }, href: `${W}finctory/` },
      { id: 'nstc-phish', kind: 'research', text: { zh: '國科會大專生計畫：生成式 AI 於社交工程', en: 'NSTC project: generative AI in social engineering' } },
      { id: 'nstc-stock', kind: 'research', text: { zh: '國科會大專生計畫：股市異常指標 × 生成式 AI 股票追蹤', en: 'NSTC project: a stock tracker with market anomalies and generative AI' } },
      { id: 'phishforge', kind: 'work', text: { zh: 'PhishForge：AI 客製釣魚信的資安演練平台', en: 'PhishForge: phishing drills written by AI' }, href: `${W}phishforge/` },
      { id: 'ched', kind: 'work', text: { zh: 'Ched.AI：研究室團隊的徵信助手', en: 'Ched.AI: the lab team’s credit-report assistant' }, href: 'https://github.com/OG-Matcha/Credit-Report' },
      { id: 'innoserve', kind: 'win', text: { zh: '大專資訊服務創新競賽 資安應用組 第一名', en: '1st place, InnoServe Awards, security track' } },
      { id: 'digital', kind: 'win', text: { zh: '臺灣數創大賞 數位＋組 金獎', en: 'Gold, Taiwan Digital Creativity Award, Digital+' } },
      { id: 'arena', kind: 'win', text: { zh: 'Startup 創業競技場 國內組 第一名', en: '1st place, Startup Arena, domestic track' } },
      { id: 'genai', kind: 'award', text: { zh: 'GenAI Stars 創意創客組 優選（Ched.AI）', en: 'Merit Award, GenAI Stars (Ched.AI)' } },
    ],
  },
  {
    year: '2025', note: { zh: '產品上架，兩座首獎', en: 'Products ship, two first prizes' },
    items: [
      { id: 'itri', kind: 'role', text: { zh: '工研院產科國際所 AI Intern', en: 'AI intern, ITRI ISTI' } },
      { id: 'lak', kind: 'research', text: { zh: 'LAK 2025 國際會議發表：知識圖譜 × LLM 分析學習軌跡', en: 'LAK 2025 paper: learning trajectories with knowledge graphs and LLMs' }, href: 'https://arxiv.org/abs/2504.11481' },
      { id: 'nstc-osave', kind: 'research', text: { zh: '國科會大專生計畫：財伴 oSave 的 82 人準實驗', en: 'NSTC project: an 82-person quasi-experiment on oSave' } },
      { id: 'osave', kind: 'work', text: { zh: '財伴 oSave 上架 iOS、Android', en: 'oSave ships on iOS and Android' }, href: `${W}osave/` },
      { id: 'catalyst', kind: 'work', text: { zh: 'Catalyst：Multi-Agent 軟體開發自動化', en: 'Catalyst: multi-agent software automation' }, href: `${W}catalyst/` },
      { id: 'surprice', kind: 'work', text: { zh: '找好康 SurPrice 上線', en: 'SurPrice goes live' }, href: `${W}surprice/` },
      { id: 'taobao', kind: 'work', text: { zh: '淘換算上架 Chrome 商店', en: 'Taobao Exchange on the Chrome Web Store' }, href: `${W}taobao/` },
      { id: 'tsmc', kind: 'win', text: { zh: '台積電校園黑客松 AI 維運懶人包組 第一名', en: '1st place, TSMC IT CareerHack, AI Ops track' } },
      { id: 'taitung', kind: 'win', text: { zh: '臺東創新創業大賽 最佳創新創業大獎', en: 'Grand prize, Taitung Innovation & Entrepreneurship' } },
    ],
  },
  {
    year: '2026', note: { zh: '第二家公司，直升碩士班', en: 'A second company, then the M.S.' },
    items: [
      { id: 'ms', kind: 'role', text: { zh: '直升中央資管碩士班', en: 'Starts the M.S. at NCU' } },
      { id: 'medalink', kind: 'work', text: { zh: '共同創辦醫數行銷 MedaLink：診所的 AI 櫃檯', en: 'Co-founds MedaLink: an AI front desk for clinics' }, href: `${W}medalink/` },
      { id: 'tessera', kind: 'work', text: { zh: 'tessera：開源的 Claude Code mod', en: 'tessera: an open-source Claude Code mod' }, href: 'https://github.com/OG-Matcha/tessera' },
      { id: 'wp', kind: 'research', text: { zh: '工作論文：投資風格之間的傳遞網路', en: 'Working paper: style transmission networks' }, href: 'papers/wp-style-transmission/' },
      { id: 'dashboard', kind: 'award', text: { zh: '雙北程式設計節 城市儀表板大黑客松 第三名', en: '3rd place, City Dashboard Hackathon' } },
      { id: 'jieban', kind: 'award', text: { zh: '臺北秋季程式設計節 城市通微服務大黑客松 佳作（捷伴）', en: 'Honorable mention, City Microservices Hackathon (Jieban)' } },
    ],
  },
];

/** "Built, and still in use": status and the figures each work page states. */
export type Work = { name: string; status: Bi; live: boolean; line: Bi; role: Bi; facts: { n: string; label: Bi }[]; href: string; clay: string };
export const FEATURED: Work[] = [
  {
    name: '醫數行銷 MedaLink', status: { zh: '上線中', en: 'Live' }, live: true, clay: 'up',
    line: { zh: '診所的 AI 櫃檯：回訊息、排時段、追回診，一套做完。', en: 'An AI front desk for clinics: replies, bookings and follow-ups in one place.' },
    role: { zh: '共同創辦人・前線部署工程師，AI 那一半由我一個人做', en: 'Co-founder and forward-deployed engineer; I built the AI half alone' },
    facts: [{ n: '4', label: { zh: '個通路進同一個收件匣', en: 'channels, one inbox' } }, { n: '2', label: { zh: '人從需求做到上線', en: 'people, idea to launch' } }],
    href: `${W}medalink/`,
  },
  {
    name: '財伴 oSave', status: { zh: '上線中', en: 'Live' }, live: true, clay: 'blue',
    line: { zh: '回答「我的財務到底健不健康」的記帳 App。', en: 'A bookkeeping app that tells you whether your finances are healthy.' },
    role: { zh: '技術長・系統架構與後端', en: 'CTO; architecture and backend' },
    facts: [{ n: '+176%', label: { zh: '每週記帳天數（82 人準實驗）', en: 'logging days a week (82-person study)' } }, { n: '8', label: { zh: '項競賽獎，3 項首獎', en: 'competition awards, 3 first prizes' } }],
    href: `${W}osave/`,
  },
  {
    name: '淘換算 Taobao Exchange', status: { zh: '上架中', en: 'Listed' }, live: true, clay: 'sun',
    line: { zh: '逛淘寶，價格旁邊直接出現台幣。', en: 'NT$ next to every Taobao price.' },
    role: { zh: '獨立開發，從零做到上架', en: 'Built solo, from zero to the store' },
    facts: [{ n: '278', label: { zh: '位 Chrome 商店使用者', en: 'Chrome Web Store users' } }, { n: '4.8★', label: { zh: '使用者評分', en: 'user rating' } }],
    href: `${W}taobao/`,
  },
];
export const MORE: Work[] = [
  { name: '斐闊 Finctory', status: { zh: '營運中', en: 'Operating' }, live: true, clay: 'down', line: { zh: '學生時期創的金融科技公司，4 條產品線、競賽獎金與補助逾 NT$100 萬。', en: 'A fintech company started as students: 4 product lines, over NT$1M in prizes and grants.' }, role: { zh: '共同創辦人・技術長', en: 'Co-founder, CTO' }, facts: [], href: `${W}finctory/` },
  { name: '找好康 SurPrice', status: { zh: '上線中', en: 'Live' }, live: true, clay: 'pink', line: { zh: '各家 DM 優惠收在同一頁，算好單位價格和剩幾天。', en: 'Every flyer’s deals on one page, with unit prices and days left.' }, role: { zh: '主要開發', en: 'Main developer' }, facts: [], href: `${W}surprice/` },
  { name: 'tessera', status: { zh: '開源', en: 'Open source' }, live: true, clay: 'violet', line: { zh: 'Windows 與中日韓文字優先的 Claude Code mod。', en: 'A Claude Code mod built Windows- and CJK-first.' }, role: { zh: '作者', en: 'Author' }, facts: [], href: 'https://github.com/OG-Matcha/tessera' },
  { name: 'PhishForge', status: { zh: '已結案', en: 'Completed' }, live: false, clay: 'up', line: { zh: 'AI 依部門寫出客製釣魚信的資安演練平台；資安應用組第一名。', en: 'Phishing drills that AI writes per department; 1st place, InnoServe security track.' }, role: { zh: '後端・AI 工程', en: 'Backend and AI' }, facts: [], href: `${W}phishforge/` },
  { name: 'Catalyst', status: { zh: '競賽作品', en: 'Hackathon' }, live: false, clay: 'blue', line: { zh: 'AI agent 小組接力改程式、測試、部署；台積電黑客松第一名。', en: 'AI agents that rewrite, test and deploy code in relay; 1st place, TSMC IT CareerHack.' }, role: { zh: '介面設計', en: 'Interface design' }, facts: [], href: `${W}catalyst/` },
  { name: 'Ched.AI', status: { zh: '研究室作品', en: 'Lab project' }, live: false, clay: 'grey', line: { zh: '給授信人員的生成式 AI 徵信助手；GenAI Stars 優選。', en: 'A generative-AI credit assistant for account officers; Merit Award, GenAI Stars.' }, role: { zh: '團隊成員', en: 'Team member' }, facts: [], href: 'https://github.com/OG-Matcha/Credit-Report' },
];

export const RESEARCH: { year: string; clay: string; title: Bi; result?: Bi; who: Bi; href?: string }[] = [
  { year: '2025–26', clay: 'pink', title: { zh: '國科會大專生計畫：財伴 oSave 的實證研究', en: 'NSTC undergraduate project: an empirical study of oSave' }, result: { zh: '4 週準實驗 82 人：每週記帳天數 +176%，預算達成率翻倍到 76.8%，財務焦慮顯著下降（p<0.01）', en: '4-week quasi-experiment, 82 people: logging days a week +176%, budget attainment doubled to 76.8%, financial anxiety significantly down (p<0.01)' }, who: { zh: '邱信瑜教授', en: 'Prof. Hsin-Yu Chiu' } },
  { year: '2025', clay: 'violet', title: { zh: 'LAK 2025 Practitioner Track：運用知識圖譜與大型語言模型追蹤、分析學習軌跡', en: 'LAK 2025 Practitioner Track: Leveraging Knowledge Graphs and Large Language Models to Track and Analyze Learning Trajectories' }, result: { zh: 'LAK 是學習分析領域的旗艦國際會議（SoLAR 主辦）。LLM 把教材轉成知識圖譜，再用學生的測驗資料畫出每個人的學習軌跡，也找出考題可能的偏差。第二作者，與 Yu-Hxiang Chen、Jia-Yu Hung、張家凱合著', en: 'LAK is the flagship international conference of learning analytics (run by SoLAR). An LLM turns course material into a knowledge graph, then each student’s test data into a learning-trajectory graph, which also flags possible bias in exam questions. Second author, with Yu-Hxiang Chen, Jia-Yu Hung and Chia-Kai Chang' }, href: 'https://arxiv.org/abs/2504.11481', who: { zh: '張家凱教授', en: 'Prof. Chia-Kai Chang' } },
  { year: '2024–25', clay: 'up', title: { zh: '國科會大專生計畫：結合股市異常現象指標及生成式 AI 之股票追蹤系統', en: 'NSTC undergraduate project: a stock tracker combining market anomalies with generative AI' }, who: { zh: '邱信瑜教授', en: 'Prof. Hsin-Yu Chiu' } },
  { year: '2024–25', clay: 'down', title: { zh: '國科會大專生計畫：探討生成式 AI 於社交工程之發展應用', en: 'NSTC undergraduate project: generative AI in social engineering' }, result: { zh: 'PhishForge 的研究版', en: 'The research side of PhishForge' }, who: { zh: '胡雅涵教授', en: 'Prof. Ya-Han Hu' } },
];
