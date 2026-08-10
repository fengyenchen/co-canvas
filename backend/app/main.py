from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import GenerateSuggestionRequest, GenerateSuggestionResponse

app = FastAPI(
    title="Co-Canvas API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "co-canvas-api",
    }


@app.post(
    "/api/suggestions/generate",
    response_model=GenerateSuggestionResponse,
    response_model_exclude_none=True,
)
async def generate_suggestion(
    request: GenerateSuggestionRequest,
) -> GenerateSuggestionResponse:
    return GenerateSuggestionResponse.model_validate(
        {
            "nodes": [
                {
                    "tempId": "suggestion-1",
                    "title": "釐清目標",
                    "content": f"確認「{request.prompt}」希望達成的具體結果。",
                },
                {
                    "tempId": "suggestion-2",
                    "title": "拆解執行步驟",
                    "content": "將目標拆成可以逐步完成的行動。",
                },
                {
                    "tempId": "suggestion-3",
                    "title": "檢查風險",
                    "content": "找出可能遇到的問題與替代方案。",
                },
            ],
            "relations": [
                {
                    "sourceTempId": "suggestion-1",
                    "targetTempId": "suggestion-2",
                    "label": "接著",
                },
                {
                    "sourceTempId": "suggestion-2",
                    "targetTempId": "suggestion-3",
                    "label": "最後",
                },
            ],
        }
    )
