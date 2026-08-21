# Co-Canvas

Co-Canvas 是一套結合 AI 對話與視覺化節點畫布的人機協作系統。使用者可以選取節點作為上下文，透過對話要求 AI 拆解、延伸、比較或整理內容，再決定是否將建議加入畫布。

## 主要功能

- 可新增、編輯、拖曳、連線與自動排版的節點畫布
- AI 對話、節點生成預覽與 Gemini Structured Outputs
- 本機畫布與 localStorage 自動保存
- Neon Postgres 雲端專案
- Neon Auth 登入與註冊
- 私人／公開專案及擁有者、編輯者、檢視者權限
- JSON 與 PNG 匯出
- Undo／Redo、節點搜尋及響應式介面

## 技術架構

- 前端：React、TypeScript、Vite、Tailwind CSS、React Flow、Zustand、Zod
- 後端：FastAPI、Pydantic、SQLAlchemy、Alembic
- AI：Google Gemini（`google-genai`）或內建 Mock 模式
- 資料庫與驗證：Neon Postgres、Neon Auth
- 測試：Vitest

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
│  └─ requirements.txt
└─ README.md
```

## 首次安裝

以下指令以 Windows PowerShell 為例。

### 1. 安裝前端套件

```powershell
cd C:\co-canvas\frontend
npm install
```

### 2. 建立後端虛擬環境

```powershell
cd C:\co-canvas\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 環境變數

分別複製前後端的 `.env.example`，建立自己的 `.env`：

```powershell
cd C:\co-canvas\backend
Copy-Item .env.example .env
cd C:\co-canvas\frontend
Copy-Item .env.example .env
```

接著依照範例檔中的註解填入設定。若暫時沒有 Gemini API Key，可將後端 `AI_MODE` 改成 `mock`。請勿提交包含真實連線字串或 API Key 的 `.env`。

前端所有以 `VITE_` 開頭的變數都會包含在瀏覽器程式碼中，因此只能放公開設定；資料庫連線字串、Gemini API Key 與加密金鑰只能放在後端 `.env`。

## Neon 資料庫設定

1. 在 Neon 建立 Postgres 專案。
2. 將 pooled connection string 填入 `DATABASE_URL`。
3. 將未啟用 connection pooling 的 direct connection string 填入 `DATABASE_MIGRATION_URL`。
4. 在 Neon 啟用 Auth，並設定前後端需要的 Auth URL 與 JWKS URL。
5. 套用現有 migrations：

```powershell
cd C:\co-canvas\backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

查看目前 migration 版本：

```powershell
alembic current
```

## 啟動專案

前端與後端需要分別在兩個 PowerShell 視窗啟動。

### Terminal 1：啟動後端

```powershell
cd C:\co-canvas\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

### Terminal 2：啟動前端

```powershell
cd C:\co-canvas\frontend
npm run dev
```

開啟：

- 產品首頁：<http://localhost:5173>
- 專案列表：<http://localhost:5173/projects>
- FastAPI：<http://localhost:8000>
- API 文件：<http://localhost:8000/docs>

## 健康檢查

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

```powershell
cd C:\co-canvas\frontend
npm run build
```

建置結果位於 `frontend/dist`。靜態網站服務需支援 SPA fallback，讓未知路徑回傳 `index.html`。

部署後端時，將 `CORS_ALLOWED_ORIGINS` 設為實際前端網址；若有多個網址，以逗號分隔且不要加入路徑：

```dotenv
CORS_ALLOWED_ORIGINS=https://co-canvas.example.com,https://www.co-canvas.example.com
```

套用資料庫 migration 後啟動 API：

```powershell
cd C:\co-canvas\backend
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

若部署平台提供動態連接埠，請將 `8000` 改成平台提供的 `PORT`。正式環境的 `.env` 應透過部署平台的秘密環境變數設定，不要提交到 Git。

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

- 擁有者：可編輯內容、重新命名、管理權限及刪除專案。
- 編輯者：可編輯內容與重新命名，但不能管理權限或刪除專案。
- 檢視者：只能查看與匯出內容。
- 私人專案：只有擁有者及指定成員可以開啟。
- 公開專案：取得連結的訪客依公開訪客權限檢視或編輯。

## 開發檢查

在 `frontend` 目錄執行：

```powershell
npm run lint
npm test -- --run
npm run build
```
