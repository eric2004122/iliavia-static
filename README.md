# 伊樆 𐓷 椏樆椏 Iliavia — 靜態網站版

非官方粉絲共編筆記的靜態網站版，掛在 Cloudflare Pages（免費），澳門、台灣和其他地區都能直接開。

- GitHub Actions 約每小時讀一次固定的 Google 共編文件（唯讀、不登入、不修改文件），產生整個網站，**內容有變才重新發布**。
- 頁面和 Sites 版一樣：首頁、介紹、共編筆記（六個分頁的完整原文與原圖）、更新紀錄、閱讀設定、關於這裡。
- 沒有伺服器：搜尋、「再抽一句」、「隨機抽一個」都在瀏覽器裡做。
- 性癖、生理期、身體疾病欄位預設收合；預設不讓搜尋引擎收錄。

## 第一次設定（約 15 分鐘）

帳號、金鑰都要你自己建立，不要把金鑰貼到聊天或寫進程式。

1. **推到 GitHub**：建立一個新的 repo（私人或公開都可以），把這個資料夾推上去，分支用 `main`。
2. **Cloudflare 帳號**：到 [dash.cloudflare.com](https://dash.cloudflare.com/) 註冊免費帳號，不用綁信用卡。
3. **找 Account ID**：登入後進「Workers & Pages」，右側欄有 **Account ID**，複製起來。
4. **建立 API Token**：右上角頭像 → My Profile → API Tokens → Create Token → 最下面 **Create Custom Token**
   - Permissions：`Account` → `Cloudflare Pages` → `Edit`
   - Account Resources：選你的帳號
   - 建立後複製 token（只會顯示一次）
5. **填進 GitHub**：repo → Settings → Secrets and variables → Actions
   - **Secrets** 頁籤新增兩個：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
   - **Variables** 頁籤（都是選填）：
     | 名稱 | 用途 | 預設 |
     |---|---|---|
     | `CF_PAGES_PROJECT` | Pages 專案名稱，網址會是 `https://<名稱>.pages.dev` | `iliavia` |
     | `SEARCH_INDEXING` | 設 `1` 才讓搜尋引擎收錄 | 不收錄 |
     | `CONTACT_EMAIL` | 頁尾與關於頁的回報信箱 | 不顯示 |
     | `SITE_URL` | 網站網址（只在允許收錄時用來產生 sitemap） | 無 |
6. **第一次發布**：repo → Actions → 左邊「更新並發布網站」→ Run workflow。跑完（約 2–5 分鐘）網站就在 `https://<專案名稱>.pages.dev`。專案名稱被別人用過時，Cloudflare 會自動加後綴，實際網址看 Cloudflare 的 Workers & Pages 頁面。

之後每小時自動檢查；想馬上更新就到 Actions 手動 Run workflow。

## 本機指令（Node.js 22 以上）

```bash
npm ci
npm test                 # 用合成資料測試，不連網
npm run build            # 讀 Google 文件，產生 dist/（上一次的內容存在 .state/）
npm run build:offline    # 不連網，用 .state/ 的內容重新產生網頁（改版面時用）
npm run preview          # 本機預覽 http://127.0.0.1:8788/
```

## 運作方式

- `build.mjs`：讀 Google 文件 → 更新 `.state/` → 呼叫 `src/site.mjs` 寫出 `dist/`。
- `src/source.mjs`：只跟固定文件的匯出網址與 Google 自己的轉址；TXT 是原文，HTML 只拿原圖與連結，兩邊文字必須一致。原文讀取失敗就整次停止，線上網站維持原樣。
- 圖片匯出（HTML）失敗會再試一次；還是失敗時文字照樣更新，那一頁的圖片和連結沿用上一次。
- `src/state.mjs`：上一次的內容、最近 30 筆更新紀錄和原圖放在 `.state/`，由 GitHub Actions 快取帶到下一次（不進 Git）。快取被清掉時就從頭收錄，網站內容不受影響，只是更新紀錄重新開始。
- `src/views.mjs`：頁面 HTML，沿用 Sites 版的結構與 `public/static/` 的 CSS。所有原文都經過轉義。
- `public/static/reader-search.js`：瀏覽器端搜尋（標出命中、摘要、上一筆／下一筆、各分頁命中數）。
- `dist/_headers`：CSP、noindex 等安全標頭；`dist/_redirects`：舊網址導向。

## 注意

- **GitHub 免費額度**：公開 repo 不限分鐘數；私人 repo 每月 2,000 分鐘，每小時跑一次大約用 700–1,200 分鐘。不夠的話把 `.github/workflows/deploy.yml` 的 cron 改成每兩小時（`17 */2 * * *`），並把 `src/views.mjs` 裡的「約每小時」一起改掉。
- **排程停用**：repo 連續 60 天沒有任何推送時，GitHub 會自動停用排程，到 Actions 頁面按一下重新啟用即可。
- 內容只能從 Google 文件修改；網站不提供線上編輯。
