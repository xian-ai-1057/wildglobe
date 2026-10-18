# WildGlobe 野生地球

旋轉 3D 地球，點選國家，就能觀看當地正在直播的野生動物與自然頻道。
Spin a 3D globe, tap a country, and watch live wildlife and nature streams from there.

目前收錄 16 個國家、30 個 YouTube 直播（棕熊、非洲水坑、信天翁巢、黑面琵鷺、珊瑚礁…）。

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
- 直播影片 ID 有時會因主辦方重開直播而改變。執行 `npm run check-streams`，失效的項目會列出該頻道目前正在播的影片，挑一個替換即可。
- 請只收錄官方或保育單位的真實攝影機，避免重播或 AI 生成的「假直播」。

## 部署 Deployment

本專案是純前端靜態網站，部署到 [Vercel](https://vercel.com)：

1. 在 Vercel 後台選 **Add New → Project → Import Git Repository**，選擇 `wildglobe`
2. Framework 會自動偵測為 **Vite**，Build Command `npm run build`、Output Directory `dist`，直接按 Deploy
3. 之後每次 push 到 `main` 都會自動重新部署

## 技術 Tech stack

[Vite](https://vite.dev) · React · TypeScript · [react-globe.gl](https://github.com/vasturiano/react-globe.gl)（three.js）· [world-atlas](https://github.com/topojson/world-atlas) 國界資料

地球貼圖來自 [three-globe](https://github.com/vasturiano/three-globe) 範例（NASA Blue Marble）。直播內容版權屬各頻道所有，本站僅以 YouTube 官方嵌入方式播放。
