# 伊樆 𐓷 椏樆椏 Iliavia 靜態網站版規範

- 使用繁體中文。這是使用者要求的免費靜態版：GitHub Actions 讀固定 Google 文件 → 產生 `dist/` → 發布到這個 repo 的 GitHub Pages（使用者同意 repo 公開，不用 Cloudflare 或其他服務）。與 `Documents\ChatGPT\AVIA\sites\iliavia`（ChatGPT Sites 版）是兩個獨立網站，互不覆蓋。
- 只讀固定文件 `13x6pnxR9hUFTuAVysBHGWa7fpOAoG6oL3NpMdANsOIA` 的六個啟用分頁（`src/catalog.mjs`）；原稿 `t.0` 不讀取。不修改 Google 文件、不帶 Cookie、不登入。
- 原文一字不改：版面只切分排版，所有原文經 `h()` 轉義；介紹頁讀不到的欄位就不顯示，不補寫、不編造。性癖、生理期、身體疾病只改成預設收合。
- 不生成、重繪或修改角色圖片；原圖以 bytes 的 SHA-256 命名原樣發布。梗圖替代文字（`src/profile-image-alts.mjs`）是站方描述，不是原文。
- `.state/`、`dist/`、`node_modules/` 不進 Git（已在 .gitignore）：Google 文件的內容和原圖只出現在發布出去的網站，不進公開 repo。不需要任何金鑰或 Secrets。
- 站內網址在版面裡一律從 `/` 開始，由 `src/site.mjs` 的 `withBase()` 加上 GitHub Pages 的 `/repo名稱/`；瀏覽器端腳本的網址都從 `data-*-url` 屬性讀，不要寫死 `/data/`、`/images/`。
- 網站設定只用 GitHub Actions Variables：`SEARCH_INDEXING`（預設不收錄）、`CONTACT_EMAIL`、`SITE_URL`。沒有後台、沒有伺服器端程式。
- 驗證：`npm ci`、`npm test`（合成資料，不連網）。改版面可用 `npm run build:offline` 與 `npm run preview` 在本機確認。
- 部署只透過 `.github/workflows/deploy.yml`（推到 `main`、排程或手動執行）；不要另外建立付費資源。
