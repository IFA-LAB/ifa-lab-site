# IFA Lab 網站

國立中央大學資訊管理學系智能金融分析實驗室（IFA Lab）的網站。Astro 7 靜態網站，繁中（`/zh-tw/`，預設）與英文（`/en/`）。

## 指令

```sh
npm install
npm run dev      # 本機開發 http://localhost:4321/zh-tw/
npm run build    # 自訂區塊規則 → astro check → 建置到 dist/ → 頁面重量檢查
```

## 資料放哪

| 內容 | 檔案 |
|---|---|
| 成員（一人一檔） | `src/data/members/<id>.json` |
| 期刊與工作論文 | `src/data/publications.json` |
| 碩士論文 | `src/data/theses.json` |
| 國科會計畫 | `src/data/grants.json` |
| 實驗室簡介、研究領域、指導教授、學生專案 | `src/data/lab.ts` |
| 介面文字（中英） | `src/i18n/ui.ts` |

資料格式定義在 `src/content.config.ts`。文字欄位都是 `{ "zh": "...", "en": "..." }`；英文缺的時候，英文頁會顯示中文並標註。

成員可以自選的只有 `figure.clay`（`blue`／`up`／`down`／`sun`／`pink`／`grey`）和 `figure.accessory`（`none`／`cat`／`phones`／`glasses`／`guitar`），其他顏色不會通過建置。

`placeholder: true` 的成員顯示灰色公仔與「資料準備中」。

## 成員自己改頁面

看 [CONTRIBUTING.md](CONTRIBUTING.md)（給人）和 [AGENTS.md](AGENTS.md)（給 AI）。規則由 `scripts/check-custom.mjs` 自動檢查，PR 上由 `.github/workflows/check.yml` 執行。

## 規則

- 台股慣例：紅漲綠跌（`--clay-up` 紅、`--clay-down` 綠）。
- 手機號碼、私人信箱不放進 repo；公開的只有學校信箱與 GitHub／LinkedIn／個人網站。
- `scripts/seed-members.py` 只用來從舊站搬一次資料，之後直接改 JSON。

規劃書：`../ifa-lab-plan.html`
