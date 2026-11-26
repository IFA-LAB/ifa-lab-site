import type { Bi } from '@/i18n/ui';

/** Site-wide lab facts. Migrated from sites.google.com/view/ifa-lab on 2026-11-25. */
export const lab = {
  name: { zh: '智能金融分析實驗室', en: 'Intelligent Finance Analytics Lab' } satisfies Bi,
  short: 'IFA Lab',
  tagline: { zh: '在金融創新與洞察上領先', en: 'Leadership in finance innovation and insights' } satisfies Bi,
  dept: { zh: '國立中央大學 管理學院 資訊管理學系', en: 'Department of Information Management, National Central University' } satisfies Bi,
  founded: '2023-08',
  mission: [
    {
      zh: 'IFA Lab 是中央大學資管系的金融科技與 AI 實驗室，研究範圍涵蓋金融智慧、資料分析、AI 與機器學習、資產定價、行為財務、實證財務、財務預測，以及應用開發與視覺化。',
      en: 'IFA Lab is a fintech and AI research lab in the Department of Information Management at National Central University. Our work spans financial intelligence, data analytics, AI and machine learning, asset pricing, behavioral finance, empirical finance, forecasting, and application development and visualization.',
    },
    {
      zh: '我們用創新研究推動金融領域的發展，建立能提高預測準確度的模型，協助決策者做出更好的判斷。',
      en: 'We advance finance through innovative research and build models that improve forecast accuracy for decision-makers.',
    },
    {
      zh: '我們連結財務理論、資訊科技與實務，為產業、政府與學術界提供可用的成果。',
      en: 'We bridge financial theory, information technology and practice for industry, government and academia.',
    },
  ] satisfies Bi[],
  contact: {
    email: 'hychiu@ncu.edu.tw',
    phone: '+886-3-4227151 ext. 66533',
    /** Where the students work. */
    lab: { zh: '中央大學 志希館 712 室', en: 'Room 712, Zhixi Building, National Central University' } satisfies Bi,
    /** The advisor's office (department faculty page). */
    room: { zh: '邱信瑜老師辦公室：管理二館 I1‑932', en: 'Prof. Chiu’s office: Room I1‑932, Management Building II' } satisfies Bi,
    address: { zh: '32001 桃園市中壢區中大路 300 號', en: 'No. 300, Zhongda Rd., Zhongli District, Taoyuan City 32001, Taiwan' } satisfies Bi,
  },
};

export type AreaKey = 'empirical' | 'behavioral' | 'pricing' | 'ai' | 'forecast' | 'apps';

/** The six research areas. `clay` picks the block colour on the research city. */
export const areas: { key: AreaKey; name: Bi; blurb: Bi; clay: string; /** for tight spots like filter chips */ short?: Bi }[] = [
  { key: 'empirical', clay: 'blue', name: { zh: '實證財務', en: 'Empirical Finance' }, blurb: { zh: '用台灣與國際市場資料檢驗理論。', en: 'Testing theory with Taiwan and global market data.' } },
  { key: 'behavioral', clay: 'pink', name: { zh: '行為財務', en: 'Behavioral Finance' }, blurb: { zh: '處分效果、投資人關注與情緒。', en: 'Disposition effect, investor attention and sentiment.' } },
  { key: 'pricing', clay: 'sun', name: { zh: '資產定價', en: 'Asset Pricing' }, blurb: { zh: '隨機優勢、異常報酬與衍生性商品定價。', en: 'Stochastic dominance, anomalies and derivative pricing.' } },
  { key: 'ai', clay: 'down', name: { zh: 'AI 與機器學習', en: 'AI and Machine Learning' }, blurb: { zh: '可解釋 AI、混合模型與大型語言模型。', en: 'Explainable AI, hybrid models and LLMs.' } },
  { key: 'forecast', clay: 'up', name: { zh: '財務預測', en: 'Financial Forecasting' }, blurb: { zh: '圖神經網路、相似性預測與時序模型。', en: 'Graph networks, similarity-based and time-series forecasting.' } },
  { key: 'apps', clay: 'violet', name: { zh: '應用與視覺化', en: 'Applications and Visualization' }, short: { zh: '應用與視覺化', en: 'Apps & Viz' }, blurb: { zh: '投資推薦系統、AI 助手與資料視覺化。', en: 'Investment recommenders, AI assistants and data visualization.' } },
];

export const advisor = {
  name: { zh: '邱信瑜', en: 'Hsin-Yu Chiu' } satisfies Bi,
  title: { zh: '副教授兼副系主任', en: 'Associate Professor and Deputy Chair' } satisfies Bi,
  scholarsUrl: 'https://scholars.ncu.edu.tw/en/persons/hsin-yu-chiu/',
  researchGateUrl: 'https://www.researchgate.net/profile/Hsin-Yu-Chiu-qiuxinyu',
  facultyUrl: 'https://im.mgt.ncu.edu.tw/teacher',
  awards: [{ zh: '113 學年度管理學院教學優良獎', en: 'Teaching Excellence Award, School of Management, NCU (2024⁠–⁠25)' }] satisfies Bi[],
  bio: {
    zh: '政治大學金融學博士（指導教授：江彌修），曾任中央研究院經濟研究所博士後研究（與許育進合作）。進入學界前在宏泰人壽與元大銀行從事風險管理、衍生性商品定價與商品開發。研究聚焦資產定價、行為財務、AI 與機器學習，以及用歷史資料建構投資組合；重視教學與學生的學術成長。',
    en: 'PhD in Money and Banking from National Chengchi University (advisor: Mi-Hsiu Chiang), followed by a postdoc at the Institute of Economics, Academia Sinica, with Yu-Chin Hsu. Before academia he worked on risk management, derivatives pricing and product development at Hontai Life Insurance and Yuanta Bank. His research focuses on asset pricing, behavioral finance, AI and machine learning, and portfolio formation from historical data. He values teaching and students’ academic growth.',
  } satisfies Bi,
  education: [
    { degree: { zh: '博士', en: 'PhD' }, school: { zh: '國立政治大學 金融學系', en: 'National Chengchi University, Money and Banking' }, period: '2009–2016' },
    { degree: { zh: '碩士', en: 'Master' }, school: { zh: '國立中央大學 財務金融學系', en: 'National Central University, Finance' }, period: '2004–2006' },
    { degree: { zh: '學士', en: 'Bachelor' }, school: { zh: '國立臺灣大學 工商管理學系', en: 'National Taiwan University, Business Administration' }, period: '1999–2004' },
  ],
  experience: [
    { title: { zh: '副教授', en: 'Associate Professor' }, org: { zh: '中央大學 資訊管理學系', en: 'NCU, Information Management' }, period: '2023/02–' },
    { title: { zh: '副教授', en: 'Associate Professor' }, org: { zh: '屏東大學 財務金融學系', en: 'National Pingtung University, Finance' }, period: '2020/08–2023/01' },
    { title: { zh: '助理教授', en: 'Assistant Professor' }, org: { zh: '屏東大學 財務金融學系', en: 'National Pingtung University, Finance' }, period: '2017/08–2020/07' },
    { title: { zh: '博士後研究', en: 'Postdoctoral Researcher' }, org: { zh: '中央研究院 經濟研究所', en: 'Institute of Economics, Academia Sinica' }, period: '2017/01–2017/07' },
    { title: { zh: '襄理', en: 'Assistant Manager' }, org: { zh: '元大銀行 金融交易行銷部', en: 'Yuanta Bank, Treasury Marketing' }, period: '2009/03–2009/09' },
    { title: { zh: '風險管理專員', en: 'Risk Management Specialist' }, org: { zh: '宏泰人壽', en: 'Hontai Life Insurance' }, period: '2008/01–2009/02' },
  ],
  licenses: [
    { zh: '金融風險管理師（FRM）', en: 'Financial Risk Manager (FRM)' },
    { zh: '證券高級業務員', en: 'Senior Securities Specialist' },
    { zh: '期貨業務員', en: 'Futures Specialist' },
    { zh: '理財規劃人員', en: 'Financial Planning Personnel' },
    { zh: '外匯交易專業能力測驗', en: 'Proficiency Test on Foreign Exchange Trading' },
    { zh: '理財規劃人員專業能力測驗', en: 'Proficiency Test for Financial Planning Personnel' },
  ] satisfies Bi[],
  research: ['Data Science & Fintech', 'Behavioral & Empirical Finance', 'Asset Pricing', 'Similarity-based Prediction', 'Machine Learning', 'Derivatives Pricing', 'Risk Management', 'Credit Market'],
  /** Shown as tags; the bands go on their own line so a name like Porter Robinson never splits. */
  hobbies: [
    { zh: '電吉他與樂團', en: 'Electric guitar & band' },
    { zh: '搖滾', en: 'Rock' }, { zh: '金屬', en: 'Metal' },
    { zh: 'Breakbeat', en: 'Breakbeat' }, { zh: 'Trance', en: 'Trance' }, { zh: 'House', en: 'House' }, { zh: 'Fusion', en: 'Fusion' },
    { zh: '愛貓', en: 'Cat lover' },
  ] satisfies Bi[],
  artists: ['The Gathering', 'Porter Robinson', 'Snarky Puppy'],
};

export const studentProjects = [
  {
    name: 'Ched.AI',
    year: 2024,
    award: { zh: '2024 GenAI Stars 創意創客組優選', en: 'Merit Award, Creative Maker track, GenAI Stars 2024' } satisfies Bi,
    desc: {
      zh: '給企業金融授信人員（AO）用的生成式 AI 助手：上傳企業的財報與徵信資料，直接用對話問營運、財務比率與風險，省下翻文件寫授信報告的時間。可接 OpenAI，也能用 Ollama 在本機跑 Llama 3，敏感資料不必出門。',
      en: 'A generative-AI assistant for corporate-banking account officers: upload a company’s financial statements and credit files, then ask about operations, ratios and risks in plain conversation instead of digging through documents to write a credit report. Runs on OpenAI or locally on Llama 3 via Ollama, so sensitive data can stay in-house.',
    } satisfies Bi,
    members: ['yun-cheng-chiang', 'dao-en-liu', 'chia-en-tsai', 'ju-shen-huang'],
    links: [{ label: 'GitHub', url: 'https://github.com/OG-Matcha/Credit-Report' }],
    photo: 'chad-ai',
    photoAlt: { zh: 'Ched.AI 團隊四人在 2024 GenAI Stars 合影，手比 C 字', en: 'The four-person Ched.AI team at GenAI Stars 2024, making a C with their hands' } satisfies Bi,
  },
] as {
  name: string; year: number; desc: Bi; members: string[]; award?: Bi; by?: Bi;
  links: { label: string; url: string }[]; photo?: string; photoAlt?: Bi;
}[];
