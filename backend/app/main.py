import asyncio
import logging
from collections.abc import Awaitable
from typing import TypeVar

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai.errors import APIError

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


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "co-canvas-api",
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
    return await run_gemini(chat_with_gemini(request))


@app.post(
    "/api/suggestions/generate",
    response_model=GenerateSuggestionResponse,
    response_model_exclude_none=True,
)
async def generate_suggestion(
    request: GenerateSuggestionRequest,
) -> GenerateSuggestionResponse:
    return await run_gemini(generate_with_gemini(request))
