# 伊樆 𐓷 椏樆椏 Iliavia — 靜態網站版

非官方粉絲共編筆記的靜態網站版，免費掛在 GitHub Pages，澳門、台灣和其他地區都能直接開。

- GitHub Actions 約每 15 分鐘讀一次固定的 Google 共編文件（唯讀、不登入、不修改文件），產生整個網站，**內容有變才重新發布**。
- 管理員也可以在網站的「管理員：更新網站」頁（`/admin/`）按「更新網站」，馬上重新讀取並發布。
- 頁面和 Sites 版一樣：首頁、介紹、共編筆記（六個分頁的完整原文與原圖）、更新紀錄、閱讀設定、關於這裡。
- 沒有伺服器：搜尋、「再抽一句」、「隨機抽一個」都在瀏覽器裡做。
- 性癖、生理期、身體疾病欄位預設收合；預設不讓搜尋引擎收錄。
- 只需要 GitHub 帳號，不用其他服務、不用金鑰。

## 第一次設定（約 5 分鐘）

1. **推到 GitHub**：建立一個**公開**的 repo（免費方案的 GitHub Pages 只能用在公開 repo），把這個資料夾推上去，分支用 `main`。Repo 裡只有程式，Google 文件的內容和圖片不會進 Git。
2. **開啟 Pages**：repo → Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
3. **第一次發布**：repo → Actions → 左邊「更新並發布網站」→ Run workflow。跑完（約 2–5 分鐘）網站就在 `https://<你的帳號>.github.io/<repo名稱>/`，Settings → Pages 上方也會顯示網址。
   - 推上去的當下會自動跑一次；如果那時還沒做第 2 步，那次會失敗，做完第 2 步再手動跑一次就好。

之後每 15 分鐘自動檢查（Google 文件改了之後，通常半小時內會出現在網站上）；想馬上更新，就用下面的「更新網站」按鈕，或到 Actions 手動 Run workflow。

### 管理員的「更新網站」按鈕

網站頁尾有「管理員：更新網站」，打開是 `/admin/`。第一次要貼上自己的 GitHub 權杖：

1. GitHub 右上角頭像 → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token。
2. Repository access 選 **Only select repositories**，只選這個 repo；Permissions → Repository permissions → **Actions: Read and write**，其他都不用開；Expiration 建議 90 天。
3. 複製 `github_pat_` 開頭的權杖，貼到管理頁按「儲存權杖」。之後按「更新網站」，頁面會顯示進度，完成後約 2～5 分鐘上線。

- 權杖只存在管理員自己的瀏覽器（不勾「在這台裝置記住」就只到關閉分頁為止），只會送到 `api.github.com`，網站與 repo 都不保存。一般訪客沒有權杖，看得到頁面也按不動。
- 這種權杖只能用在自己或所屬組織的 repo。要讓其他管理員也能按，最簡單是把 repo 移到免費的 GitHub 組織（Organization），再把他們加進組織。
- 管理頁的安全政策只允許連到 `api.github.com`，其他頁面一律只連本站。

### 選填設定

repo → Settings → Secrets and variables → Actions → **Variables** 頁籤：

| 名稱 | 用途 | 預設 |
|---|---|---|
| `SEARCH_INDEXING` | 設 `1` 才讓搜尋引擎收錄 | 不收錄 |
| `CONTACT_EMAIL` | 頁尾與關於頁的回報信箱 | 不顯示 |
| `SITE_URL` | 自訂網域時填網站網址（產生 sitemap 用） | GitHub Pages 網址 |

## 本機指令（Node.js 22 以上）

```bash
npm ci
npm test                 # 用合成資料測試，不連網
npm run build            # 讀 Google 文件，產生 dist/（上一次的內容存在 .state/）
npm run build:offline    # 不連網，用 .state/ 的內容重新產生網頁（改版面時用）
npm run preview          # 本機預覽 http://127.0.0.1:8788/
```

想在本機模擬 GitHub Pages 的網址前綴，建置和預覽都設同一個 `BASE_PATH`（例如 `/iliavia-static`）。

## 運作方式

- `build.mjs`：讀 Google 文件 → 更新 `.state/` → 呼叫 `src/site.mjs` 寫出 `dist/`。
- `src/source.mjs`：只跟固定文件的匯出網址與 Google 自己的轉址；TXT 是原文，HTML 只拿原圖與連結，兩邊文字必須一致。原文讀取失敗就整次停止，線上網站維持原樣。
- 圖片匯出（HTML）失敗會再試一次；還是失敗時文字照樣更新，那一頁的圖片和連結沿用上一次。
- `src/state.mjs`：上一次的內容、最近 30 筆更新紀錄和原圖放在 `.state/`，由 GitHub Actions 快取帶到下一次（不進 Git）。快取被清掉時就從頭收錄，網站內容不受影響，只是更新紀錄重新開始。
- `src/views.mjs`：頁面 HTML，沿用 Sites 版的結構與 `public/static/` 的 CSS。所有原文都經過轉義；安全政策（CSP）寫在每一頁的 `<meta>` 裡，因為 GitHub Pages 不能自訂回應標頭。
- `src/site.mjs`：GitHub Pages 的專案網址前面有 `/repo名稱/`，產生網頁時由 `withBase()` 統一加在站內連結前面（`BASE_PATH` 由 Actions 自動提供）。
- `public/static/reader-search.js`：瀏覽器端搜尋（標出命中、摘要、上一筆／下一筆、各分頁命中數）。

## 注意

- **免費額度**：公開 repo 的 GitHub Actions 不限分鐘數；GitHub Pages 網站上限 1 GB（目前約 30 MB）、每月流量建議 100 GB 以內。
- **排程停用**：repo 連續 60 天沒有任何推送時，GitHub 會自動停用排程，到 Actions 頁面按一下重新啟用即可。
- **檢查頻率**：目前每 15 分鐘（`.github/workflows/deploy.yml` 的 cron `2,17,32,47 * * * *`）。要改的話，也把 `src/views.mjs` 裡的「約每 15 分鐘」一起改掉。GitHub 的排程最快每 5 分鐘，但越密越常延遲，不建議再快。
- 內容只能從 Google 文件修改；網站不提供線上編輯。
