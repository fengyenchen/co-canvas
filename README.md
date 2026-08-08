# Co-Canvas

Co-Canvas 是一個結合 AI 對話與節點畫布的人機協作系統。

目前專案包含：

- 前端：React、TypeScript、Vite、Tailwind CSS、React Flow
- 後端：FastAPI、Pydantic
- AI：預計串接 Google Gemini

## 環境需求

開始前請先安裝：

- [Node.js](https://nodejs.org/) 20 以上版本
- [Python](https://www.python.org/) 3.12 以上版本

## 專案結構

```text
co-canvas/
├─ frontend/          # React 前端
│  ├─ src/
│  ├─ package.json
│  └─ vite.config.ts
└─ backend/           # FastAPI 後端
   ├─ app/
   │  └─ main.py
   └─ requirements.txt
```

## 首次安裝

### 1. 安裝前端套件

在 PowerShell 執行：

```powershell
cd C:\co-canvas\frontend
npm install
```

### 2. 建立後端虛擬環境

```powershell
cd C:\co-canvas\backend
py -m venv .venv
```

啟用虛擬環境：

```powershell
.\.venv\Scripts\Activate.ps1
```

安裝 Python 套件：

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 啟動專案

前端與後端需要分別在兩個 PowerShell 視窗啟動。

### Terminal 1：啟動前端

```powershell
cd C:\co-canvas\frontend
npm run dev
```

前端網址：

```text
http://localhost:5173
```

### Terminal 2：啟動後端

```powershell
cd C:\co-canvas\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

後端網址：

```text
http://localhost:8000
```

API 文件：

```text
http://localhost:8000/docs
```

健康檢查：

```text
http://localhost:8000/health
```

正常情況下，健康檢查會回傳：

```json
{
  "status": "ok",
  "service": "co-canvas-api"
}
```

## 建置前端

檢查前端是否能成功產生正式版本：

```powershell
cd C:\co-canvas\frontend
npm run build
```
