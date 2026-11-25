# 怎麼改自己的頁面

這份給 IFA Lab 的成員，也給你叫來幫忙的 AI（Claude Code、Cursor、Copilot、Gemini 都一樣）。
**用 AI 寫沒問題，規則一樣要過。** 規則全部有自動檢查，不合格的 PR 合併不了，所以不用擔心改壞網站。

---

## 你可以改的三個地方

| 想做的事 | 改哪裡 | 需要寫程式嗎 |
|---|---|---|
| 簡介、經歷、獎項、專案、連結、公仔顏色和配件 | `src/data/members/<你的 id>.json` | 不用，改文字就好 |
| 換照片 | `src/assets/members/<你的 id>.jpg`（正方形、至少 400px） | 不用 |
| 做一個完全屬於自己的區塊（互動、3D、小遊戲、作品展示） | `src/custom/<你的 id>/` 整個資料夾 | 要，可以叫 AI 寫 |

`<你的 id>` 就是 `src/data/members/` 裡你的檔名，例如 `ju-shen-huang`。

**一個 PR 只改你自己的這三個地方。** 想改網站本體（版型、選單、別人的頁面），另開 PR 找維護者。

---

## 第一次：5 步驟做出自己的區塊

```sh
# 1. 下載專案、裝套件（Node 22 以上）
git clone https://github.com/IFA-LAB/ifa-lab-site.git
cd ifa-lab-site
npm install

# 2. 開自己的分支
git switch -c custom/<你的 id>

# 3. 複製範例資料夾當起點
cp -r src/custom/ju-shen-huang src/custom/<你的 id>

# 4. 邊改邊看（存檔就會更新）
npm run dev
# 打開 http://localhost:4321/zh-tw/members/<你的 id>/

# 5. 送出前自己先檢查一次（跟 PR 上跑的一模一樣）
npm run build
```

`npm run build` 最後出現 `✓ 自訂區塊檢查通過`，再 push 開 PR。沒過的話，訊息會寫是哪個檔案、違反哪條規則、怎麼修。

### 叫 AI 幫你做的時候

直接把下面這段貼給 AI，再加上你想做什麼：

```prompt
我在 IFA Lab 網站（Astro 7 + React 19 + three.js）做自己的成員區塊。
先讀 CONTRIBUTING.md 和 AGENTS.md，照裡面的規則做。
只能改 src/custom/<我的 id>/、src/data/members/<我的 id>.json、src/assets/members/<我的 id>.*。
做完跑 npm run build，要看到「✓ 自訂區塊檢查通過」才算完成；把指令輸出貼給我。

我想做的是：<例如：把我的三個專案做成可以翻面的積木卡片>
```

---

## 規則（自動檢查的就是這些）

| 編號 | 規則 | 為什麼 |
|---|---|---|
| R1 | 資料夾叫 `src/custom/<你的 id>/`，入口檔叫 `Section.astro` | 網站用這個名字找到你的區塊 |
| R2 | 只放 `.astro .tsx .ts .css .json`、圖片 `.webp .avif .jpg .png .svg`、3D 模型 `.glb` | 影片太大，請放 YouTube 連結 |
| R3 | 每張圖 ≤ 300 KB、每個模型 ≤ 1.5 MB、整個資料夾 ≤ 2 MB；你的區塊讓頁面多出的 JS ≤ 80 KB（gzip）、頁面 HTML ≤ 200 KB | 手機打開要快 |
| R4 | 不載入外部的 script、字型、iframe、CSS；執行時不連網（不用 `fetch`、`eval`） | 速度、隱私、安全 |
| R5 | 顏色和字型只用網站的 token（下表） | 深淺主題自動切換、整站看起來是同一套 |
| R6 | 不用 `position: fixed`、`!important`、`:global()`，不改 `document.body`，不自動跳頁 | 你的區塊不能蓋住或改到網站其他地方 |
| R7 | 互動元件只用 `client:visible` 或 `client:idle` | 等捲到才載入，不拖慢首屏 |
| R8 | 只能 import 你自己的資料夾、`react`、`three`、`@react-three/fiber`、`@/i18n/ui`、`@/components/three/util`、`astro:assets` | 需要別的套件請先開 issue |
| R9 | 一個 PR 只改一位成員自己的檔案 | 審查容易、出事好回復 |

另外還有兩條不是自動檢查，但審查時會看：

- **中英文都要有。** 用 `lang` 判斷顯示哪種語言（範例裡有寫法）；英文頁不能出現只有中文的內容。
- **不放隱私資料。** 手機、私人信箱、住址不要放；別人的照片要本人同意。

### 可以用的 token

| 用途 | token |
|---|---|
| 黏土色 | `var(--clay-blue)` `var(--clay-up)`（紅，上漲）`var(--clay-down)`（綠，下跌）`var(--clay-sun)` `var(--clay-pink)` `var(--clay-grey)` |
| 文字 | `var(--ink)`（主要）`var(--ink-2)`（次要） |
| 底色 | `var(--surface)` `var(--surface-2)` |
| 強調（連結、按鈕） | `var(--accent)` |
| 字型 | `var(--f-body)` `var(--f-display)` `var(--f-mono)` |
| 間距 | `var(--space-1)` 到 `var(--space-10)`（4px 到 128px） |
| 圓角 | `var(--r-sm)` `var(--r-md)` `var(--r-lg)` `var(--r-full)` |
| 動畫 | `var(--dur-fast)` `var(--dur-base)` `var(--ease-out)` |

黏土質感的陰影可以用 `rgb(0 0 0 / 0.18)` 和 `rgb(255 255 255 / 0.35)` 這兩種半透明黑白，其他顏色一律用 token。

### 動畫與無障礙

- 有動畫的話，加上 `@media (prefers-reduced-motion: reduce)` 把動作關掉；3D 用 `@/components/three/util` 的 `usePrefersReducedMotion()`。
- 可以點的東西至少 44×44px，用 `<button>` 或 `<a>`，不要用 `<div onClick>`。
- 圖片要有 `alt`；純裝飾的圖用 `alt=""`。
- 3D 場景先用 `canRun3D()` 判斷裝置撐不撐得住，撐不住就顯示靜態版本。

---

## PR 流程

1. push 你的分支，到 GitHub 開 PR，標題寫 `custom(<你的 id>): 做了什麼`。
2. GitHub Actions 自動跑：規則檢查（R1–R9）→ 型別與資料格式檢查 → 建置 → 頁面重量檢查。全部綠燈才能合併。
3. 維護者看一眼（中英文、隱私、內容），按合併。
4. 合併後幾分鐘，Cloudflare 自動部署上線。

紅燈的話點進 Actions 的紀錄，最下面就是沒過的規則和修法；改好再 push，同一個 PR 會重跑。

## 卡住了

- 先問你的 AI：「讀 CONTRIBUTING.md，告訴我這個錯誤怎麼修」，再貼上錯誤訊息。
- 還是不行就開 issue，或在實驗室群組問維護者。
