# 網站全面盤點清單

最後一次全面檢查：2026-11-28。網址：https://ifalab-ncu.com

這份清單列出網站上線後要顧好的每一個環節：每一項怎麼檢查、多久自動檢查一次、目前狀態。
favicon 那次的問題出在「沒有人檢查這一項」；現在每一項都有負責檢查的工具，大部分每次部署都會自動重跑。

## 怎麼檢查（工具與時機）

| 工具 | 檢查什麼 | 什麼時候跑 | 失敗會怎樣 |
|---|---|---|---|
| `npm run build`（`scripts/check-custom.mjs`、`astro check`、頁面重量） | 成員自訂區塊規則、型別、JS 與 HTML 大小上限 | 每次 push、每個 PR | CI 紅燈，不部署 |
| CI「Smoke test the live site」 | 部署後首頁、成員頁、K 喵 API 都活著 | 每次部署後 | CI 紅燈 |
| `node scripts/audit-live.mjs https://ifalab-ncu.com` | 下面「A–F」所有項目，逐頁檢查 sitemap 上的 66 頁 | 每次部署後（CI「Audit the live site」）；也可手動跑 | 任何 FAIL → 結束碼 1、CI 紅燈 |
| `node services/ask/regress.mjs` | K 喵回答：該答的答得出、不該講的不講（亂編人名、錯課程） | 改 K 喵或資料後手動跑 | 列出失敗題目 |
| Lighthouse | 效能、無障礙、最佳做法、SEO 分數 | 大改版後手動跑 | — |
| axe-core（淺色／深色 × 手機 390／桌機 1440） | 對比、標籤、按鈕名稱等 WCAG 問題 | 大改版後手動跑 | — |
| Google Search Console（服務帳號 API） | 收錄狀態、sitemap、結構化資料錯誤 | Google 寄信時、或每月看一次 | — |

## A. 連線與網址

| 項目 | 狀態 | 證據 |
|---|---|---|
| http 轉 https（301） | ✅ | audit `http-to-https` |
| www 轉主網域、保留路徑 | ✅ | audit `www-to-apex` |
| 結尾斜線統一（301） | ✅ | audit `trailing-slash` |
| 根目錄 `/` 正常 | ✅ | audit `root` |
| 不存在的頁面回 404 且標 noindex | ✅ | audit `404-status`、`404-noindex` |
| 舊網址 workers.dev 301 到正式網域（不留重複副本） | ✅ | audit `old-domain` |

## B. 回應標頭（安全與快取）

| 項目 | 狀態 | 證據 |
|---|---|---|
| HTML 宣告 `charset=utf-8` | ✅ | audit `html-content-type` |
| HSTS（一年） | ✅ | audit `hsts` |
| `X-Content-Type-Options: nosniff` | ✅ | audit `nosniff` |
| `Referrer-Policy` | ✅ | audit `referrer-policy` |
| 防點擊劫持（`X-Frame-Options: SAMEORIGIN`） | ✅ | audit `clickjacking` |
| `Permissions-Policy`（關閉相機、麥克風、定位等） | ✅ | `public/_headers` |
| 壓縮（brotli） | ✅ | audit `compression` |
| 靜態資源長期快取（immutable）、HTML 每次重新驗證 | ✅ | audit `asset-cache`、`html-cache` |
| Content-Security-Policy | ⏸ 未設 | 見「待你決定」 |

## C. 網站圖示與根目錄檔案

| 項目 | 狀態 | 證據 |
|---|---|---|
| `favicon.ico`（48×48，Google 搜尋結果要 48 的倍數） | ✅ | audit `favicon.ico-size` |
| `favicon.svg`、48／96／192 PNG、`apple-touch-icon`（180） | ✅ | audit `file …`，實際讀圖檔量尺寸 |
| Web manifest（192＋512＋maskable） | ✅ | audit `manifest` |
| `robots.txt` 允許全部、指向 sitemap | ✅ | audit `robots.txt`、`robots-sitemap` |
| sitemap 66 頁、都是 https、本網域、有 hreflang | ✅ | audit `sitemap*` |
| `llms.txt`（給 AI 搜尋讀的網站摘要） | ✅ | audit `llms.txt` |
| `/.well-known/security.txt` | ⚠ 沒有 | 見「待你決定」 |

## D. 每一頁的 head 與結構化資料（66 頁逐頁）

| 項目 | 狀態 | 證據 |
|---|---|---|
| `lang`、charset、viewport、title、description | ✅ | audit `pages` |
| canonical 指向自己、hreflang（en／zh／x-default） | ✅ | audit `pages` |
| og:* 與 twitter:card、分享圖 ≥ 1200×630 | ✅ | audit `pages`、`images` |
| 每頁剛好一個 h1 | ✅ | audit `pages` |
| JSON-LD：成員頁 ProfilePage 有 `mainEntity`（Google 那封信的問題） | ✅ 已修 | audit `pages`；GSC 要你按「驗證修正」 |
| JSON-LD：FAQPage、論文 ScholarlyArticle、Person、Organization、Breadcrumb | ✅ | audit `pages` |
| 標題、描述不重複；描述 70–170 字 | ✅ | audit `title-unique`、`description-unique`、`desc-length` |
| 圖片都有 alt、width、height；沒有混合內容 | ✅ | audit `pages` |
| 74 個內部連結都通、83 張圖都載得到 | ✅ | audit `links`、`images` |
| 成員頁都在 sitemap 裡 | ✅ | audit `sitemap-coverage` |

## E. K 喵（/api/ask）

| 項目 | 狀態 | 證據 |
|---|---|---|
| GET 回 405、別的網站來的請求回 403 | ✅ | audit `api-get`、`api-origin` |
| 回答裡的中文人名一定出自資料（不亂編） | ✅ | `worker/index.ts` `realNames()`；regress |
| 回歸測試題組 | ✅ | `node services/ask/regress.mjs`（模型抽樣，偶爾一題不穩） |

## F. 無障礙與效能

| 項目 | 狀態 | 證據 |
|---|---|---|
| 連結色對比 ≥ 4.5:1（淺色 `#3463aa`、深色 `#94b5ec`，所有卡片底色） | ✅ 11/28 修 | axe 12 頁 × 2 主題 × 2 寬度：0 個問題（你的自訂區塊除外） |
| 「現在」標籤對比 | ✅ 11/28 修 | 同上 |
| 語言切換鈕的讀屏名稱包含看得到的字（手機上的「EN／中」） | ✅ 11/28 修 | 同上 |
| Lighthouse SEO／最佳做法 | ✅ 100 | 11/28 |
| Lighthouse 無障礙 | ✅ 96–100 | 11/28 |
| Lighthouse 效能：一般頁 | ✅ 94–98 | 11/28 |
| Lighthouse 效能：有 3D 的頁 | ⚠ 63–72 | 見「待你決定」；LCP 1.8–2.8 秒、CLS ≈ 0 |

## G. Google 收錄（Search Console，11/28）

- sitemap 11/27 送出，0 錯誤；大部分頁面已收錄。
- 還沒收錄（「已發現，尚未建立索引」）的 10 頁：英文論文 3 頁、中文論文 5 頁、成員 kai-xiang-chang、yu-bin-chen。新網站常見，通常幾週內會收；可在 GSC 對這幾頁按「要求建立索引」加快。

## 待你決定

1. **Search Console 按兩個鈕（2 分鐘）**：在「資料頁面」報告按「驗證修正」；對上面 10 個未收錄頁按「要求建立索引」。只能用你的帳號在網頁上按。
2. **security.txt 的聯絡信箱**：要寫誰的信箱收資安回報？建議實驗室公用信箱；沒有的話用老師公開的信箱，或不設（目前只是 WARN）。
3. **3D 頁的效能分數**：分數低是因為 Lighthouse 用軟體模擬 GPU、主執行緒被 3D 佔住。實際手機上 LCP 正常。要拉高可以延後載入 3D（點了或捲到才載），代價是首屏少了 3D 動畫。建議維持現狀。
4. **你自己的自訂區塊**：年份小字 `.jsk-yr` 對比 2.38:1（要 4.5），以及「Yu-Hxiang Chen」拼字（應該是 Yu-Hsiang？）。在 `src/custom/ju-shen-huang/`，是你的區塊，我沒動。
5. **Content-Security-Policy**：目前沒設。加了更安全，但站上有內嵌腳本，要逐一列 hash，之後改版容易踩到。建議先不加。
