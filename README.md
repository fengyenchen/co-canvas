# Co-Canvas

Co-Canvas 是一套結合 AI 對話與視覺化節點畫布的人機協作系統。使用者可以選取節點或群組作為上下文，透過對話要求 AI 拆解、延伸、比較或整理內容，再決定是否將建議加入畫布。

## 主要功能

- 可新增、編輯、拖曳、連線與自動排版的節點畫布
- 可命名、著色、收合、鎖定、複製與拖曳節點群組，並以整組結構作為 AI 對話上下文
- AI 對話、節點生成預覽與 Gemini Structured Outputs
- 本機畫布與 localStorage 自動保存
- Neon Postgres 雲端專案
- Neon Auth 登入與註冊
- 私人／公開專案及擁有者、編輯者、檢視者權限
- 約 2 秒更新的雲端協作、三方自動合併與後端過期版本保護
- 雲端對話顯示可識別的訊息發送者
- 雲端專案搜尋、排序、複製、垃圾桶及版本紀錄
- JSON 與 PNG 匯出
- Undo／Redo、畫布內容複製貼上、節點搜尋、React Joyride 操作導覽、完整情境範例及響應式介面
- 多影片節點、片段時間區間與點擊定位
- 文件與圖片節點、公開直連、本機預覽與 Gemini 附件分析
- YouTube、Dropbox、公開影片及本機 MP4／WebM／MOV 片段對話分析
- 本機 MP4／WebM／MOV 即時播放與片段標記（原始檔只保存在目前瀏覽器，不會上傳至專案）
- AI 建議決策事件紀錄、研究資料 CSV 匯出與瀏覽器內分析工具

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
5. 在 Neon Auth 啟用 Email 驗證。使用者註冊後會進入驗證等待頁，60 秒後可重新寄送驗證信；完成驗證前不能登入或進入雲端專案。
6. 若要自動清理未驗證帳號，在後端設定 `NEON_API_KEY`、`NEON_PROJECT_ID`、production 的 `NEON_BRANCH_ID`、`RESEND_WEBHOOK_SECRET`、`AUTH_CLEANUP_SECRET` 與 `AUTH_AUDIT_HASH_SECRET`。這些都是後端秘密，不能使用 `VITE_` 前綴或提交到 Git。
7. 套用現有 migrations：

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

### 未驗證帳號自動清理

這項功能只會刪除仍為未驗證狀態的帳號；每次刪除前都會重新讀取 Auth 資料，因此已完成 Email 驗證的帳號不會被清理。

1. 在 Resend Dashboard 建立 webhook，正式網址填入 `https://你的後端網域/api/webhooks/resend`，事件只勾選 `email.bounced`；將 Signing secret 填入後端 `RESEND_WEBHOOK_SECRET`。永久退信送達後，系統會立即清理對應的未驗證帳號。
2. 專案內的 `.github/workflows/cleanup-unverified-users.yml` 會每小時呼叫一次清理端點。到 GitHub Repository → Settings → Secrets and variables → Actions 建立 `CO_CANVAS_API_BASE_URL`（例如 `https://api.example.com`）與 `AUTH_CLEANUP_SECRET`；後者必須和後端環境變數完全相同。也可改用部署平台排程，以 `POST` 呼叫 `/api/internal/auth/cleanup-unverified` 並帶入 `X-Cleanup-Secret`。預設刪除建立超過 24 小時且仍未驗證的帳號。
3. 重新部署後端並執行 `alembic upgrade head`，建立 webhook 去重表與匿名帳號事件表。Resend 重送同一事件時不會重複處理。清理紀錄只保存 HMAC 雜湊、原因及時間，不保存被刪除帳號的明文 Email。

本機可用下列指令測試排程端點；請把範例 secret 換成 `.env` 的值：

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:8000/api/internal/auth/cleanup-unverified `
  -Headers @{ "X-Cleanup-Secret" = "你的排程密鑰" }
```

排程成功會回傳候選、已刪除與略過數量。端點回傳 `401` 代表排程密鑰不符；`503` 通常代表 Neon API 設定、Auth 資料表或資料庫連線尚未完成。

### 帳號管理與驗證歡迎信

1. 在後端設定 `AUTH_ADMIN_EMAILS`，可用逗號分隔多個管理者 Email。白名單會在後端驗證，只有隱藏前端按鈕並不構成權限保護。
2. 管理者登入後，可從首頁最下方進入「帳號管理」，或直接開啟 `/admin/auth`，查看已驗證、等待驗證及永久退信數量。
3. 在 Resend 建立 API Key，設定後端 `RESEND_API_KEY` 與已驗證網域的 `RESEND_FROM_EMAIL`；`APP_PUBLIC_URL` 設成正式前端網址。使用者完成 Email 驗證並首次進入專案後，系統會寄出一次歡迎信。
4. 歡迎信以資料庫唯一紀錄及 Resend `Idempotency-Key` 防止重複寄送；若寄信服務暫時失敗，不會阻擋使用者進入專案，下次進入時會再嘗試。

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

## 雲端即時協作

開啟雲端專案後，前端每 2 秒檢查一次後端最新版，分頁重新取得焦點時也會立即同步。這套同步適用於節點、欄位、位置、連線、群組、對話與 AI 建議事件；它不會顯示其他使用者的游標或逐字輸入過程。

多人或多分頁同時編輯時，前端以最後共同保存的文件作為基準進行三方合併：

- 不同節點或不同欄位的修改會同時保留。
- 同一欄位同時修改時，保留目前分頁正在輸入的內容，再基於後端最新版重試保存。
- 後端仍使用 `expectedUpdatedAt` 與 HTTP 409 阻止舊文件直接覆蓋新文件；409 由前端自動取得最新版並合併，不建立衝突副本。
- 網路暫時失敗時，本機復原資料會保留，前端每 2 秒自動重試；右下角會顯示「正在合併其他使用者的更新」、「已同步」或重試狀態。

對話訊息會顯示來源。AI 回覆標示為「AI」；目前登入者自己的訊息顯示「我」；其他登入者優先顯示 Auth 帳號姓名，沒有姓名時才顯示 Email。作者 ID 與 Email 由後端依 JWT 登入憑證寫入；姓名也優先採用憑證中的可信欄位，因此新訊息不能透過專案內容冒用他人身分。舊訊息若沒有作者欄位，介面會顯示「使用者」。

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
- 本機 MP4／WebM／MOV、YouTube、Dropbox MP4／MOV 與公開 MP4／MOV 可將所選片段提供給 Gemini 分析。
- Vimeo 與 Bilibili 目前支援內嵌播放及片段定位，不會將影片內容提供給 Gemini。
- Dropbox 必須使用單一影片檔案的分享連結，資料夾或預覽連結無法分析。
- 本機、Dropbox 與公開影片檔案上限為 450 MB；大型影片首次處理可能需要數分鐘。

本機影片會保存在目前瀏覽器的私人檔案空間，刷新後仍可恢復，但不會寫入雲端專案或同步到其他裝置。只有從已設定時間區間的文字節點發送對話時，瀏覽器才會將影片分段交給 Co-Canvas 後端轉送至 Gemini Files API；後端不保存完整影片。同一瀏覽器與同一 API Key 設定下的後續對話會重用有效的 Gemini 檔案。

處理 Dropbox 或公開影片時，後端會先將檔案下載至暫存空間，再上傳至 Gemini Files API。後端下載檔會在上傳後立即刪除；Gemini 檔案會依 API Key 指紋與影片來源建立約 47 小時的快取，同一影片後續對話可直接重用，不需再次下載與上傳。

快取只保存不可逆的 API Key 指紋、影片來源雜湊及 Gemini 檔案識別資訊，不保存明文 API Key。快取過期後會在後續請求中移除資料庫紀錄，Gemini Files API 的檔案也會依服務期限自動失效。

## 文件與圖片節點

- 文件節點支援 PDF、TXT／Markdown／CSV／JSON、DOCX、XLSX、PPTX。
- 圖片節點支援 PNG、JPG、WebP、HEIC／HEIF、BMP。
- 兩種節點都可使用本機檔案或公開、免登入的 HTTPS 原檔直連，並能連線、分組及作為 AI 對話上下文；預覽頁、登入頁與資料夾連結不支援。
- 圖片、PDF 與文字資料可在側欄預覽；現代 Office 格式會在對話前抽取文字，再交給 Gemini 分析。
- 本機原檔只保存在目前瀏覽器的私人檔案空間，刷新後可恢復，不會寫入雲端專案或同步到其他裝置；PDF 上限為 50 MB，其他支援檔案上限為 100 MB。

操作流程：按「新增節點」選擇文件或圖片，選取本機檔案或套用公開網址，等待本機檔案保存完成後，雙擊節點進入對話即可讓 AI 讀取附件。雲端專案只同步節點與附件描述；若改用其他瀏覽器、裝置或網域，必須重新選擇本機原檔。

文件或圖片節點也可連到文字節點，由文字節點對話自動附上相連原檔。PDF 與 PPTX 可在文字節點新增「文件頁面範圍」屬性，分別指定頁碼或投影片範圍；本機 PDF／PPTX 會自動讀取總頁數。DOCX 沒有跨環境一致的固定分頁，因此目前分析完整文件。

## 選用的研究資料擴充

以下功能是獨立於一般 Co-Canvas 產品操作的研究工具；只使用畫布、AI 對話或影片功能時不需要設定或閱讀本節。完整說明請參考網站中的「研究資料利用方式」。

### 研究資料匯出

雲端專案擁有者可從「專案 → 匯出研究資料」下載 CSV。事件會在使用者做出決策後立即寫入，操作者由當下登入帳號判定，並依事件 ID 去重；本機畫布、編輯者與檢視者不能匯出。

`actorId` 由後端依登入憑證寫入。同一帳號在不同瀏覽器或裝置操作仍計為同一位參與者；不同帳號計為不同參與者。這項辨識與對話介面的作者姓名分開處理，研究 CSV 不包含姓名、Email 或完整訊息。研究事件透過獨立 API 追加並依 `clientEventId` 去重，不會被畫布的即時合併覆蓋。

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

### 瀏覽器研究分析工具

開啟 `/research/analyze`，或從首頁與研究資料指南選擇「分析 CSV」。分析工具支援同時匯入多個 Co-Canvas 研究事件 CSV，並在瀏覽器內完成欄位驗證、依 `clientEventId` 去重、Mock 排除及選用的 1.5 × IQR 決策時間離群值處理；檔案不會上傳至後端。

匯入後會直接計算全部結果，不需要選擇研究設計、指標或統計方法。每個 CSV 的實驗條件預設取自檔名，任務名稱可以留空；需要自訂比較時再修改即可。除行為比例、修改率、決策時間、建議規模、參與者比較與時間趨勢外，工具也同時提供組間與組內假設下可計算的非參數檢定、效果量、Wilson 95% 信賴區間與決策序列。研究者應依實際研究設計採用對應結果。

「下載完整 ZIP 報表」包含清理後事件、參與者／條件／時間／序列摘要、資料品質報告、分析設定、易讀 HTML 報告、欄位字典及 Python／R 範例。圖表直接嵌在 HTML 報告內，可查看或自行截圖。工具會直接為接受率、修改率、決策時間與建議節點數輸出組間及組內檢定、效果量與 Wilson 95% 信賴區間；研究者應依實際研究設計選用適合的結果，正式推論建議再以專業統計軟體複核。

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

E2E 會啟動獨立的 Vite 測試伺服器，並以瀏覽器層的固定回應取代 Neon Auth、專案 API 與 Gemini，因此不會建立真實帳號、不會修改 Neon 資料，也不會消耗 Gemini 額度。目前涵蓋登入、建立專案、畫布儲存、複製分享連結、版本恢復、影片片段分析、多人訊息作者顯示，以及不同欄位與同欄位的同步合併。

在 `backend` 目錄執行：

```bat
python -m pytest
```

若使用 PowerShell，虛擬環境啟用指令才是 `.\.venv\Scripts\Activate.ps1`。
