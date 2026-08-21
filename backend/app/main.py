import asyncio
import logging
from collections.abc import Awaitable
from typing import TypeVar

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai.errors import APIError

from app.database import DatabaseConnectionError, check_database_connection
from app.routers.ai_credentials import router as ai_credentials_router
from app.routers.projects import router as projects_router
from app.schemas import (
    ChatRequest,
    ChatResponse,
    GenerateSuggestionRequest,
    GenerateSuggestionResponse,
)
from app.services.gemini import (
    GeminiConfigurationError,
    chat_with_gemini,
    generate_with_gemini,
)
from app.services.mock import chat_with_mock, generate_with_mock
from app.settings import get_settings


logger = logging.getLogger(__name__)
ResponseT = TypeVar("ResponseT")

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

app.include_router(projects_router)
app.include_router(ai_credentials_router)


@app.get("/health")
async def health():
    settings = get_settings()

    return {
        "status": "ok",
        "service": "co-canvas-api",
        "aiMode": settings.ai_mode,
        "geminiConfigured": settings.gemini_api_key is not None,
        "databaseConfigured": settings.database_url is not None,
        "authConfigured": settings.neon_auth_jwks_url is not None,
    }


@app.get("/health/database")
async def database_health():
    try:
        is_configured = await check_database_connection()
    except DatabaseConnectionError as error:
        raise HTTPException(
            status_code=503,
            detail="資料庫連線失敗",
        ) from error

    if not is_configured:
        return {
            "status": "not_configured",
            "database": "neon-postgres",
        }

    return {
        "status": "ok",
        "database": "neon-postgres",
    }


async def run_gemini(operation: Awaitable[ResponseT]) -> ResponseT:
    try:
        async with asyncio.timeout(30):
            return await operation
    except GeminiConfigurationError as error:
        raise HTTPException(
            status_code=503,
            detail="Gemini API Key 尚未設定",
        ) from error
    except TimeoutError as error:
        raise HTTPException(
            status_code=504,
            detail="Gemini 回應逾時",
        ) from error
    except APIError as error:
        logger.warning("Gemini API error: %s", error.code)

        if error.code in (400, 401, 403):
            raise HTTPException(
                status_code=401,
                detail="Gemini API Key 無效",
            ) from error

        if error.code == 429:
            raise HTTPException(
                status_code=429,
                detail="Gemini 額度不足或請求過多",
            ) from error

        raise HTTPException(
            status_code=502,
            detail="Gemini 服務暫時無法使用",
        ) from error
    except (RuntimeError, ValueError) as error:
        logger.exception("Invalid Gemini response")
        raise HTTPException(
            status_code=502,
            detail="Gemini 回傳格式無效",
        ) from error


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    if get_settings().ai_mode == "mock":
        return chat_with_mock(request)

    return await run_gemini(chat_with_gemini(request))


@app.post(
    "/api/suggestions/generate",
    response_model=GenerateSuggestionResponse,
    response_model_exclude_none=True,
)
async def generate_suggestion(
    request: GenerateSuggestionRequest,
) -> GenerateSuggestionResponse:
    if get_settings().ai_mode == "mock":
        return generate_with_mock(request)

    return await run_gemini(generate_with_gemini(request))
