# 我的在地小旅行｜在地景點網站產生器

給台灣國中生使用的離線優先網站製作工具。學生用繁體中文表單填寫景點、美食、廟宇或歷史文化介紹，加入照片、影片與每位組員的製作心得後，就能下載可繼續編輯的作品備份，以及可直接發布的獨立靜態網站 ZIP。

所有編輯內容、照片與本機影片只保存在瀏覽器的 IndexedDB，不會上傳到本專案的伺服器。本專案不使用分析服務、Cookie、外部字型或需要 API Key 的服務；預覽 YouTube 或 Google Maps 時，瀏覽器仍會連線到對應的外部服務。

學生可在第一步的「進階：用自己的 CSS 調整外觀」中，一鍵下載目前網站的**完整** `style.css`（包含主題、封面、導覽、照片、亮點、心得與手機排版），修改後上傳並即時預覽。新上傳的 CSS **完整取代**原本樣式，不混入內建主題；下載、預覽和網站 ZIP 使用同一份樣式。自訂 CSS 也會保存在作品備份中。舊版備份的少量外觀調整仍會以原來的疊加方式載入；重新下載可取得合併後的完整樣式。支援子元素選擇器、CSS 變數、偽元素、漸層與媒體查詢，封面沿用 `var(--cover)`。檔案上限為 200KB，不接受 HTML 或載入其他資源的 CSS。內建字型名稱可使用；自訂版型的對比、字級及手機可讀性需在預覽中確認。

## 推薦原因與參觀提醒：翻譯蒟蒻

第二步可分別填寫中文、英文的推薦原因與參觀提醒。「翻譯蒟蒻：產生兩段英文」會使用瀏覽器內建的本機翻譯，保留中文並填入可編輯的英文，不會將學生文章送到翻譯伺服器。不使用 API Key；第一次需連網下載瀏覽器的語言套件。已有英文時會先確認是否取代；取消、逾時或失敗會保留原文，不會套用半套翻譯。切換步驟也會取消尚未完成的翻譯。

自動翻譯依賴支援 Translator API 的電腦版瀏覽器、安全連線（HTTPS 或 localhost）及可用的中英語言套件。不能保證所有學校電腦、手機或瀏覽器都支援；不支援時會顯示中文提示，仍可直接填寫英文。請老師先確認教室環境，並帶學生校對地名、預約規定與語意。來源：[Chrome 本機翻譯說明](https://developer.chrome.com/docs/ai/translator-api)。

網站的兩段標題固定顯示中英文。兩段已有內容的區塊都備妥中英文後，預覽與匯出網站會顯示「翻譯蒟蒻 · Read in English」；讀者按一次可一起切換這兩段，再按「顯示中文 · Read in Chinese」切回。沒有參觀提醒時只需完成推薦原因。讀者端只切換已儲存的文字，**不呼叫翻譯服務，解壓後離線也能用**；未完成英文的作品仍可儲存和匯出，不會提供切到空白的按鈕。英文會一併自動儲存、備份、匯入，舊作品缺少欄位時會保留中文並補空白英文。中文有修改時，請同步更新英文。

自動測試以模擬的瀏覽器翻譯介面驗證成功、取消、失敗及內容保存，不代表已驗證實際語言模型的翻譯品質；匯出的離線切換則使用真實 Chromium 測試。

## 安裝與本機啟動

需要 Node.js 22.12 以上（建議 Node.js 24 LTS，與部署環境一致）。

```bash
npm install
npm run dev
```

依終端機顯示的網址開啟。資料會自動儲存在目前瀏覽器；無痕模式或清除網站資料可能使自動備份消失，重要內容請另行下載「作品備份」。

## 檢查與測試

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

完整瀏覽器流程測試需先安裝 Playwright Chromium：

```bash
npx playwright install chromium
npm run test:e2e
```

## Production build

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

正式檔案位於 `dist/`。正式建置使用 `/local-guide-builder/` 作為 Vite `base`；開發模式保留根目錄，避免改變既有的本機編輯網址。`npm run preview` 後請開啟終端機網址下的 `/local-guide-builder/`。本工具是單頁表單，沒有額外路由。

可重複驗證正式檔案與完整瀏覽器流程：

```bash
npm run check:dist
npm run preview -- --host 127.0.0.1 --port 4175
# 在另一個終端機執行（也可改成正式 Pages 網址）
npm run test:production -- http://127.0.0.1:4175/local-guide-builder/
```

瀏覽器測試使用隔離的新瀏覽器及程式生成的圖片，測試檔案只放在被 Git 忽略的 `test-results/`。不會操作學生正在使用的瀏覽器資料，也不會上傳作品。

## GitHub Pages 部署

1. 將專案推送到 GitHub，預設分支命名為 `main`。
2. 在儲存庫的 **Settings → Pages**，將來源設為 **GitHub Actions**。
3. 推送到 `main` 後，`.github/workflows/deploy.yml` 使用 Node.js 24、`npm ci`，執行型別檢查、lint、單元測試、build 與正式資源檢查，全部成功才發布 `dist/`。也可從 Actions 手動執行。官方 Actions 固定到已核對版本的完整 commit，部署以 Pages concurrency 排隊。
4. 若使用不同分支，修改工作流程檔中的 `branches: [main]`。

這個部署發布的是「網站產生器」。學生下載的各組網站 ZIP 可由老師另外解壓縮並放入班級網站的子資料夾。

本專案的正式網址為 https://andrewkotw.github.io/local-guide-builder/ 。儲存庫不應收學生作品；`.gitignore` 排除環境變數檔、備份、ZIP、學生繳交目錄、圖片、影片及測試輸出。`examples/class-sites/` 僅包含虛構示範文字與程式繪製的 SVG，供整合測試使用，不會打包到 `dist/`。

從本機網址換到正式網址時，瀏覽器把兩者視為不同網站，**自動備份不會自動搬過去**。請先在本機下載 `.localguide` 作品備份，再於正式網站匯入；不要先清除本機資料。

## 修改範例內容

編輯 `src/data.ts` 的 `createSampleProject()`。請使用虛構或一般性資料，不要加入學生姓名、聯絡方式或私人帳號。範例刻意不附照片，學生須使用自己有權公開的圖片。

## 新增主題

1. 在 `src/types.ts` 的 `ThemeId` 加入主題代號。
2. 在 `src/App.tsx` 的主題選單加入選項。
3. 在 `src/utils/siteGenerator.ts` 的 `themeNames` 和 `SITE_CSS` 加入對應的 CSS 變數。

主題應保持至少 16px 文字、清楚焦點框及足夠的前景／背景對比。

## 老師整合各組網站

每組匯出的 ZIP 檔名為 `類型-英文景點名稱-小組名稱.zip`，並內含固定版本的 `site-info.json`。專案已附班級首頁產生器：

```bash
npm run build:class-index -- "D:\class-sites"
```

將各組解壓縮到 `D:\class-sites\groups\各組資料夾` 後執行。工具會按類型產生班級首頁，錯誤組會被跳過並列出修正方法，不會影響其他小組。

- [老師操作說明](docs/老師操作說明.md)
- [學生繳交說明](docs/學生繳交說明.md)
- [三組整合範例](examples/class-sites/README.md)

## 主要結構

- `src/App.tsx`：五步驟編輯流程與自動儲存
- `src/components/`：步驟列、表單元件、照片管理、網站預覽
- `src/utils/photo.ts`：圖片方向處理、縮圖與 JPEG 壓縮
- `src/utils/db.ts`：瀏覽器自動備份
- `src/utils/zip.ts`：專案備份與完成網站 ZIP
- `src/utils/siteGenerator.ts`：獨立靜態網站 HTML/CSS
- `scripts/build-class-index/`：班級首頁產生器與測試
- `examples/class-sites/`：三組學生網站整合範例
- `docs/老師操作說明.md`：收件、預覽與發布流程
- `src/utils/*.test.ts`：單元測試
- `e2e/`：Playwright 完整流程測試

## 已知限制

- 圖片方向修正依賴現代瀏覽器的 `createImageBitmap(..., { imageOrientation: 'from-image' })`；建議使用最新版 Chrome、Edge 或 Firefox。
- 為避免單張照片耗盡記憶體，超過五千萬像素的圖片會要求先在手機相簿縮小；原始檔案上限仍為 15MB。
- Safari 與行動裝置的可用離線儲存容量依系統而異，大型 MP4 可能因瀏覽器空間不足而無法自動備份。
- 為避免誤選或異常壓縮檔耗盡記憶體，匯入的作品備份及其解壓後內容上限為 120MB。
- YouTube 影片需要網路。直接雙擊解壓後的 `index.html` 時，因 YouTube 不接受 `file://` 網頁的嵌入請求，網站會改顯示「前往 YouTube」按鈕；發布到 GitHub Pages 後會顯示嵌入播放器。本機 MP4 會包含在 ZIP，檔案也會較大。
- 填寫有效的 Google Maps 分享網址時，成品會依「地址」顯示小地圖並保留外開連結。小地圖需要網路，且載入時瀏覽器會連線到 Google Maps；工具不接受其他網站作為地圖 iframe。
- 自動備份只存在同一台電腦的同一個瀏覽器，跨電腦請使用 `.localguide` 專案備份檔。
