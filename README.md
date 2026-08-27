# Co-Canvas

Co-Canvas 是一套結合 AI 對話與視覺化節點畫布的人機協作系統。使用者可以選取節點或群組作為上下文，透過對話要求 AI 拆解、延伸、比較或整理內容，再決定是否將建議加入畫布。

## 主要功能

- 可新增、編輯、拖曳、連線與自動排版的節點畫布
- 可命名、拖曳與整理節點的群組，並以整組結構作為 AI 對話上下文
- AI 對話、節點生成預覽與 Gemini Structured Outputs
- 本機畫布與 localStorage 自動保存
- Neon Postgres 雲端專案
- Neon Auth 登入與註冊
- 私人／公開專案及擁有者、編輯者、檢視者權限
- 雲端專案搜尋、排序、複製、垃圾桶及版本紀錄
- JSON 與 PNG 匯出
- Undo／Redo、節點搜尋及響應式介面
- 多影片節點、片段時間區間與點擊定位
- YouTube、Dropbox MP4／MOV 及公開 MP4／MOV 片段對話分析
- AI 建議決策事件紀錄與研究資料 CSV 匯出

## 技術架構

- 前端：React、TypeScript、Vite、Tailwind CSS、React Flow、Zustand、Zod
- 後端：FastAPI、Pydantic、SQLAlchemy、Alembic
- AI：Google Gemini（`google-genai`）或內建 Mock 模式
- 資料庫與驗證：Neon Postgres、Neon Auth
- 測試：Vitest、pytest

## 環境需求

開始前請先安裝：

- [Node.js](https://nodejs.org/) 20.19 以上版本
- [Python](https://www.python.org/) 3.12 以上版本
- npm
- Neon 專案（若要使用登入與雲端專案）
- Gemini API Key（若要使用 Gemini 模式）

## 專案結構

```text
co-canvas/
├─ frontend/                 # React 前端
│  ├─ src/
│  ├─ .env.example
│  └─ package.json
├─ backend/                  # FastAPI 後端
│  ├─ alembic/               # 資料庫 migrations
│  ├─ app/
│  ├─ .env.example
│  ├─ alembic.ini
│  ├─ requirements.txt
│  └─ requirements-dev.txt
└─ README.md
```

## 首次安裝

以下指令以 Windows CMD 為例。

### 1. 安裝前端套件

```bat
cd frontend
npm install
```

### 2. 建立後端虛擬環境

```bat
cd backend
py -m venv .venv
.\.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements-dev.txt
```

啟用成功後，命令提示字元前方會出現 `(.venv)`。也可以用以下指令確認目前使用的是專案虛擬環境中的 Python：

```bat
where python
```

## 環境變數

分別複製前後端的 `.env.example`，建立自己的 `.env`：

```bat
cd backend
copy .env.example .env
cd frontend
copy .env.example .env
```

接著依照範例檔中的註解填入設定。若暫時沒有 Gemini API Key，可將後端 `AI_MODE` 改成 `mock`。請勿提交包含真實連線字串或 API Key 的 `.env`。

前端所有以 `VITE_` 開頭的變數都會包含在瀏覽器程式碼中，因此只能放公開設定；資料庫連線字串、Gemini API Key 與加密金鑰只能放在後端 `.env`。

## Neon 資料庫設定

1. 在 Neon 建立 Postgres 專案。
2. 將 pooled connection string 填入 `DATABASE_URL`。
3. 將未啟用 connection pooling 的 direct connection string 填入 `DATABASE_MIGRATION_URL`。
4. 在 Neon 啟用 Auth，並設定前後端需要的 Auth URL 與 JWKS URL。
5. 套用現有 migrations：

```bat
cd backend
.\.venv\Scripts\activate.bat
alembic upgrade head
```

查看目前 migration 版本：

```bat
alembic current
```

## 啟動專案

前端與後端需要分別在兩個 CMD 視窗啟動。

### Terminal 1：啟動後端

```bat
cd backend
.\.venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
```

### Terminal 2：啟動前端

```bat
cd frontend
npm run dev
```

開啟：

- 產品首頁：<http://localhost:5173>
- 專案列表：<http://localhost:5173/projects>
- FastAPI：<http://localhost:8000>
- API 文件：<http://localhost:8000/docs>

## 健康檢查

正式環境的監控服務建議使用以下兩個端點：

- `/health/live`：只確認 API 程序仍在運作，不依賴外部服務。
- `/health/ready`：確認 Auth 設定與資料庫連線；未就緒時回傳 `503`。

每個 API 回應都會包含 `X-Request-ID`。遇到伺服器錯誤時，可用此 ID 在部署平台的後端紀錄中搜尋同一筆請求。

確認後端設定狀態：

```text
http://localhost:8000/health
```

回應會包含目前 AI 模式，以及 Gemini、資料庫與 Auth 是否已設定：

```json
{
  "status": "ok",
  "service": "co-canvas-api",
  "aiMode": "gemini",
  "geminiConfigured": true,
  "databaseConfigured": true,
  "authConfigured": true
}
```

確認 Neon 資料庫能否連線：

```text
http://localhost:8000/health/database
```

正常情況下會回傳：

```json
{
  "status": "ok",
  "database": "neon-postgres"
}
```

## 正式環境

部署前端時，先將 `frontend/.env` 的 `VITE_API_BASE_URL` 改成正式後端網址，再建立靜態檔案：

```bat
cd frontend
npm run build
```

建置結果位於 `frontend/dist`。靜態網站服務需支援 SPA fallback，讓未知路徑回傳 `index.html`。

部署後端時，將 `CORS_ALLOWED_ORIGINS` 設為實際前端網址；若有多個網址，以逗號分隔且不要加入路徑：

```dotenv
CORS_ALLOWED_ORIGINS=https://co-canvas.example.com,https://www.co-canvas.example.com
```

套用資料庫 migration 後啟動 API：

```bat
cd backend
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

若部署平台提供動態連接埠，請將 `8000` 改成平台提供的 `PORT`。

## 本機與雲端模式

### 未登入

- 可直接使用本機畫布。
- 節點、連線與對話保存在瀏覽器 localStorage。
- 清除瀏覽器資料或更換裝置後，本機資料不會自動同步。

### 已登入

- 可建立 Neon 雲端專案並跨裝置存取。
- 可將目前本機畫布另存為雲端專案。
- 可建立私人或公開專案並設定成員權限。

### 專案權限

- 擁有者：可編輯內容、重新命名、管理權限、建立或恢復版本，以及刪除專案。
- 編輯者：可編輯內容、重新命名、建立或恢復版本，但不能管理權限或刪除專案。
- 檢視者：可查看、匯出內容及瀏覽版本紀錄，但不能建立或恢復版本。
- 私人專案：只有擁有者及指定成員可以開啟。
- 公開專案：取得連結的訪客依公開訪客權限檢視或編輯。

## 專案版本紀錄

版本紀錄只適用於雲端專案；本機畫布仍使用 localStorage 自動保存，也可以匯出 JSON 自行備份。進入雲端專案後，可從「專案 → 版本紀錄」查看、建立及恢復版本。

- 可手動建立具名稱或未命名的版本；手動版本不會被系統自動刪除。
- 編輯中的雲端專案每 10 分鐘檢查一次，只有內容已儲存至後端且相較上一個自動版本有變更時，才會建立自動版本。
- 自動版本保留 30 天，且每個專案最多保留最近 50 個自動版本。
- 恢復舊版本前會先建立「恢復前備份」，並檢查專案是否已被其他分頁或使用者更新，避免覆蓋較新的內容。
- 匯入 JSON 前會先建立「匯入前備份」；如果備份失敗，畫布不會被替換。
- 版本內容包含節點、連線、節點位置、影片時間區間、對話與 AI 建議事件，不包含專案名稱、成員或權限設定。

## 影片節點與片段分析

- 一個專案可以建立多個影片節點，並與文字節點自由連線。
- 文字節點可選擇全部影片或自訂開始與結束時間；輸入格式會依片長顯示秒、分:秒或時:分:秒，點擊片段即可跳到對應位置。
- YouTube、Dropbox MP4／MOV 與公開 MP4／MOV 連結可將所選片段提供給 Gemini 分析。
- Vimeo 與 Bilibili 目前支援內嵌播放及片段定位，不會將影片內容提供給 Gemini。
- Dropbox 必須使用單一影片檔案的分享連結，資料夾或預覽連結無法分析。
- Dropbox 與公開影片檔案上限為 450 MB；大型影片首次處理可能需要數分鐘。

處理 Dropbox 或公開影片時，後端會先將檔案下載至暫存空間，再上傳至 Gemini Files API。後端下載檔會在上傳後立即刪除；Gemini 檔案會依 API Key 指紋與影片來源建立約 47 小時的快取，同一影片後續對話可直接重用，不需再次下載與上傳。

快取只保存不可逆的 API Key 指紋、影片來源雜湊及 Gemini 檔案識別資訊，不保存明文 API Key。快取過期後會在後續請求中移除資料庫紀錄，Gemini Files API 的檔案也會依服務期限自動失效。

## 研究資料匯出

雲端專案擁有者可從「專案 → 匯出研究資料」下載 CSV。事件會在雲端專案儲存時寫入並依事件 ID 去重；本機畫布、編輯者與檢視者不能匯出。

每列代表一次 AI 建議決策，包含：

- `action`：接受（`accepted`）、取消（`rejected`）或重新生成（`regenerated`）。
- `edited`：使用者是否在決定前修改過 AI 建議。
- `decisionTimeMs`：從顯示建議到做出決策的時間。
- `nodeCount`：該次 AI 建議的節點數量。
- `aiMode`：該次使用 Gemini 或 Mock。
- `contextNodeId`：當時作為對話上下文的節點 ID。
- `actorId`：執行操作的登入使用者 ID。
- `occurredAt`、`recordedAt`：操作發生時間與後端寫入時間。

這些資料可用來比較建議接受率、修改率、重新生成率與決策時間，也能搭配任務完成時間、問卷或訪談分析不同實驗條件下的人機協作行為。CSV 不包含完整聊天文字、節點內容或影片內容。

`actorId` 與 `contextNodeId` 仍可能用來連結同一使用者或節點，因此匯出資料不是完全匿名。正式研究前應取得參與者同意、限制資料存取，並依研究需求將識別碼重新編碼或移除。若尚未對 AI 建議做出任何決策，匯出的 CSV 只會包含欄位標題。

## 開發檢查

在 `frontend` 目錄執行：

```bat
npm run lint
npm test -- --run
npm run build
```

首次執行 E2E 前，安裝 Playwright Chromium：

```bat
npx playwright install chromium
```

執行瀏覽器 E2E：

```bat
npm run test:e2e
```

E2E 會啟動獨立的 Vite 測試伺服器，並以瀏覽器層的固定回應取代 Neon Auth、專案 API 與 Gemini，因此不會建立真實帳號、不會修改 Neon 資料，也不會消耗 Gemini 額度。目前涵蓋登入、建立專案、畫布儲存、複製分享連結、版本恢復及影片片段分析資料傳送。

在 `backend` 目錄執行：

```bat
python -m pytest
```

若使用 PowerShell，虛擬環境啟用指令才是 `.\.venv\Scripts\Activate.ps1`。
