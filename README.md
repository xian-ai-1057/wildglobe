# WildGlobe 野生地球

旋轉 3D 地球，點選國家，就能觀看當地正在直播的野生動物與自然頻道。
Spin a 3D globe, tap a country, and watch live wildlife and nature streams from there.

目前收錄 21 個國家、122 個 YouTube 直播（棕熊、北極熊、大熊貓、大猩猩、非洲水坑、海獺、水母、白頭海鵰、信天翁巢、黑面琵鷺、珊瑚礁…）。

## 功能 Features

- 🌍 可拖曳旋轉的 3D 地球；有直播的國家以綠色標示，直播位置有脈衝光點
- 🗂️ 點選國家：側欄（手機為底部抽屜）列出該國直播與即時縮圖
- ▶️ 點選直播：直接在頁面中播放 YouTube 直播
- 🔍 搜尋國家（中英文皆可）、🎲 隨機看一個直播
- 🌐 繁體中文 / English 切換

## 本機開發 Local development

需要 Node.js 22 以上。

```bash
npm install
npm run dev
```

開啟 http://localhost:5173 。

其他指令：

| 指令 | 用途 |
| --- | --- |
| `npm run build` | 型別檢查並建置到 `dist/` |
| `npm run lint` | 以 oxlint 檢查程式碼 |
| `npm run format` | 以 Prettier 排版 |
| `npm run check-streams` | 檢查清單中每個直播是否仍在播、可否嵌入 |
| `npm run update-streams` | 把每個直播更新為該攝影機目前的直播（或離線時的最新錄影）；加 `-- --dry-run` 只預覽不寫入 |

## 新增直播 Adding a stream

所有直播都在 [`src/data/streams.json`](src/data/streams.json)，新增一筆即可，不需改程式：

```json
{
  "id": "etosha-okaukuejo",
  "country": "NA",
  "lat": -19.17,
  "lng": 15.91,
  "name": { "zh-TW": "埃托沙國家公園奧考奎約水坑", "en": "Okaukuejo Waterhole, Etosha" },
  "animals": { "zh-TW": "犀牛、大象、獅子", "en": "Rhinos, elephants, lions" },
  "youtube": { "videoId": "AeMUdOPFcXI", "channelId": "UC9X6gGKDv2yhMoofoeS7-Gg" },
  "source": "NamibiaCam"
}
```

- `country`：ISO 3166-1 二碼（例如 `TW`、`JP`、`US`）
- `lat` / `lng`：攝影機的大約位置
- `youtube.videoId`：直播影片 ID。若省略，會改嵌入 `channelId` 頻道「目前的直播」（適合只有一個直播的頻道）
- `youtube.match`（選填）：同一頻道同時有好幾個相似直播時，填入能辨識這台攝影機的標題文字（例如 `"Indoor"`），自動更新就只會挑標題含有這段文字的影片
- `status` 由自動更新填寫，不需手動設定：`"replay"` 表示目前不在直播時段、正在播最新錄影；`"offline"` 表示離線且沒有可播的錄影
- 請只收錄官方或保育單位的真實攝影機，避免重播或 AI 生成的「假直播」。

### 自動更新 Automatic updates

很多攝影機不是 24 小時不間斷的同一場直播：有的一天只播幾小時（例如挪威餵食台），有的每隔幾天重開一次（例如北德文花園），每一場都會換新的影片 ID。GitHub Actions 每 30 分鐘（每小時 :07、:37）會跑一次 `update-streams`（[`.github/workflows/update-streams.yml`](.github/workflows/update-streams.yml)，也可手動執行），對每個已不在直播的項目：

1. 頻道上若有同一台攝影機正在直播（以標題比對，忽略日期；或依 `youtube.match`），換成新的影片 ID
2. 若目前不在直播時段，換成這台攝影機最近一次的完整錄影並標記 `replay`，網站顯示「重播」，讓平台持續有畫面
3. 若連錄影都沒有，標記 `offline`，網站顯示「離線」，隨機播放也會略過它

有變動時自動 commit `src/data/streams.json` 到 `main`，Vercel 隨即重新部署。無法確定是同一台攝影機時不會亂換，而是留給下方的每日檢查回報。

### 自動檢查 Automated check

GitHub Actions 每天 03:17 UTC 會跑一次 `check-streams`（[`.github/workflows/stream-health.yml`](.github/workflows/stream-health.yml)，也可在 Actions 頁面手動執行）：

- 有直播失效時，自動開一個標籤為 `stream-health` 的 issue，列出失效項目與該頻道目前可替換的直播；之後的檢查會更新同一個 issue，不會重複開。標記為 `replay` 的項目只要錄影可播放就算正常
- 全部恢復正常後，自動關閉該 issue
- 檢查以頻道的直播列表和 YouTube oEmbed 判斷，避開 YouTube 對 GitHub 伺服器的機器人驗證；若仍被擋，會標成 ⚠️ blocked 而不會誤報失效

## 部署 Deployment

本專案是純前端靜態網站，部署到 [Vercel](https://vercel.com)：

1. 在 Vercel 後台選 **Add New → Project → Import Git Repository**，選擇 `wildglobe`
2. Framework 會自動偵測為 **Vite**，Build Command `npm run build`、Output Directory `dist`，直接按 Deploy
3. 之後每次 push 到 `main` 都會自動重新部署

## 技術 Tech stack

[Vite](https://vite.dev) · React · TypeScript · [react-globe.gl](https://github.com/vasturiano/react-globe.gl)（three.js）· [world-atlas](https://github.com/topojson/world-atlas) 國界資料

地球貼圖來自 [three-globe](https://github.com/vasturiano/three-globe) 範例（NASA Blue Marble）。直播內容版權屬各頻道所有，本站僅以 YouTube 官方嵌入方式播放。
