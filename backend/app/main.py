import asyncio
import logging
from collections.abc import Awaitable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated, Callable, Literal, TypeVar

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.genai.errors import APIError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import AuthenticatedUser, OptionalCurrentUser
from app.database import DatabaseConnectionError, check_database_connection
from app.database import get_database_session
from app.models import UserAiCredential
from app.middleware.request_protection import RequestProtectionMiddleware
from app.middleware.observability import ObservabilityMiddleware
from app.routers.ai_credentials import router as ai_credentials_router
from app.routers.auth_maintenance import router as auth_maintenance_router
from app.routers.projects import router as projects_router
from app.schemas import (
    AiFallbackReason,
    ChatApiResponse,
    ChatRequest,
    GenerateSuggestionApiResponse,
    GenerateSuggestionRequest,
    FileUploadStartRequest,
    VideoUploadStartRequest,
    VideoUploadStartResponse,
    VideoUploadChunkResponse,
)
from app.services.gemini import (
    GeminiConfigurationError,
    GeminiUploadStartError,
    chat_with_gemini,
    generate_with_gemini,
    forward_gemini_upload_chunk,
    start_gemini_resumable_upload,
)
from app.services.mock import chat_with_mock, generate_with_mock
from app.services.ai_credentials import (
    AiCredentialConfigurationError,
    AiCredentialEncryptionError,
    get_api_key_cipher,
)
from app.services.video_source import VideoSourceError, supports_chat_video_source
from app.settings import get_settings


logger = logging.getLogger(__name__)
ResponseT = TypeVar("ResponseT")
DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_database_session),
]
ProjectId = Annotated[str | None, Query(alias="projectId")]


@dataclass(frozen=True)
class AiRequestRuntime:
    use_mock: bool
    api_key: str | None = None
    fallback_reason: AiFallbackReason | None = None
    uses_user_key: bool = False


app = FastAPI(
    title="Co-Canvas API",
    version="0.1.0",
)

settings = get_settings()

app.add_middleware(
    RequestProtectionMiddleware,
    api_requests=settings.api_rate_limit_requests,
    ai_requests=settings.ai_rate_limit_requests,
    window_seconds=settings.rate_limit_window_seconds,
    max_body_bytes=settings.max_request_body_bytes,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ObservabilityMiddleware)

app.include_router(projects_router)
app.include_router(ai_credentials_router)
app.include_router(auth_maintenance_router)


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


@app.get("/health/live")
async def liveness_health():
    return {
        "status": "ok",
        "service": "co-canvas-api",
    }


@app.get("/health/ready")
async def readiness_health():
    current_settings = get_settings()
    checks = {
        "database": current_settings.database_url is not None,
        "auth": current_settings.neon_auth_jwks_url is not None,
    }

    if checks["database"]:
        try:
            checks["database"] = await check_database_connection()
        except DatabaseConnectionError:
            checks["database"] = False

    is_ready = all(checks.values())
    return JSONResponse(
        {
            "status": "ready" if is_ready else "not_ready",
            "service": "co-canvas-api",
            "checks": checks,
        },
        status_code=200 if is_ready else 503,
    )


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


async def run_gemini(
    operation: Awaitable[ResponseT],
    fallback: Callable[[], ResponseT] | None = None,
    timeout_seconds: float = 30,
) -> tuple[ResponseT, AiFallbackReason | None]:
    try:
        async with asyncio.timeout(timeout_seconds):
            return await operation, None
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
    except VideoSourceError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error
    except APIError as error:
        logger.warning("Gemini API error: %s", error.code)

        if fallback is not None and error.code in (400, 401, 403, 429):
            reason: AiFallbackReason = (
                "quota_exceeded"
                if error.code == 429
                else "invalid_key"
            )
            return fallback(), reason

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


async def get_user_gemini_api_key(
    session: AsyncSession,
    user: AuthenticatedUser,
) -> str | None:
    credential = await session.scalar(
        select(UserAiCredential).where(
            UserAiCredential.user_id == user.id,
            UserAiCredential.provider == "gemini",
        ),
    )

    if credential is None:
        return None

    try:
        return get_api_key_cipher().decrypt(
            credential.encrypted_api_key,
        )
    except (
        AiCredentialConfigurationError,
        AiCredentialEncryptionError,
    ):
        logger.exception("Unable to decrypt user Gemini API key")
        return None


async def resolve_ai_api_key(
    project_id: str | None,
    user: AuthenticatedUser | None,
    session: AsyncSession,
) -> AiRequestRuntime:
    settings = get_settings()

    if settings.ai_mode == "mock":
        return AiRequestRuntime(
            use_mock=True,
            fallback_reason="configured_mock",
        )

    if project_id is None or project_id == "local":
        if settings.gemini_api_key is None:
            return AiRequestRuntime(
                use_mock=True,
                fallback_reason="missing_key",
            )

        return AiRequestRuntime(
            use_mock=False,
            api_key=settings.gemini_api_key.get_secret_value(),
        )

    if user is None:
        return AiRequestRuntime(
            use_mock=True,
            fallback_reason="unauthenticated",
        )

    api_key = await get_user_gemini_api_key(session, user)
    if api_key is None:
        return AiRequestRuntime(
            use_mock=True,
            fallback_reason="missing_key",
        )

    return AiRequestRuntime(
        use_mock=False,
        api_key=api_key,
        uses_user_key=True,
    )


async def update_user_key_status(
    session: AsyncSession,
    user: AuthenticatedUser,
    status: Literal["valid", "invalid"],
) -> None:
    credential = await session.scalar(
        select(UserAiCredential).where(
            UserAiCredential.user_id == user.id,
            UserAiCredential.provider == "gemini",
        ),
    )

    if credential is None:
        return

    credential.status = status
    credential.last_validated_at = datetime.now(timezone.utc)
    await session.commit()


@app.post("/api/chat", response_model=ChatApiResponse)
async def chat(
    request: ChatRequest,
    session: DatabaseSession,
    user: OptionalCurrentUser,
    project_id: ProjectId = None,
) -> ChatApiResponse:
    runtime = await resolve_ai_api_key(
        project_id,
        user,
        session,
    )

    if runtime.use_mock:
        response = chat_with_mock(request)
        return ChatApiResponse(
            message=response.message,
            ai_mode="mock",
            fallback_reason=runtime.fallback_reason,
        )

    response, fallback_reason = await run_gemini(
        chat_with_gemini(request, runtime.api_key, session),
        fallback=lambda: chat_with_mock(request),
        timeout_seconds=(
            280
            if request.uploaded_video is not None
            or request.uploaded_file is not None
            or (
                request.selected_node
                and request.selected_node.node_type in {"document", "image"}
                and request.selected_node.file_source
            )
            or (
                request.selected_node
                and request.selected_node.linked_file
                and request.selected_node.linked_file.file_source
            )
            or (
                request.selected_node
                and request.selected_node.start_time_ms is not None
                and request.selected_node.linked_video
                and request.selected_node.linked_video.source
                and supports_chat_video_source(
                    request.selected_node.linked_video.source
                )
            )
            else 30
        ),
    )


    if runtime.uses_user_key and user is not None:
        await update_user_key_status(
            session,
            user,
            "invalid" if fallback_reason == "invalid_key" else "valid",
        )

    return ChatApiResponse(
        message=response.message,
        ai_mode="mock" if fallback_reason else "gemini",
        fallback_reason=fallback_reason,
    )


@app.post(
    "/api/video-uploads/start",
    response_model=VideoUploadStartResponse,
)
async def start_video_upload(
    request: VideoUploadStartRequest,
    session: DatabaseSession,
    user: OptionalCurrentUser,
    project_id: ProjectId = None,
) -> VideoUploadStartResponse:
    runtime = await resolve_ai_api_key(project_id, user, session)
    if runtime.use_mock or runtime.api_key is None:
        raise HTTPException(
            status_code=503,
            detail="Gemini API Key 尚未設定",
        )

    try:
        upload_url, chunk_size = await start_gemini_resumable_upload(
            runtime.api_key,
            request.file_name,
            request.mime_type,
            request.size,
        )
    except GeminiUploadStartError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=str(error),
        ) from error

    return VideoUploadStartResponse(
        upload_url=upload_url,
        chunk_size=chunk_size,
    )


@app.post(
    "/api/video-uploads/chunk",
    response_model=VideoUploadChunkResponse,
)
async def upload_video_chunk(
    request: Request,
    user: OptionalCurrentUser,
    project_id: ProjectId = None,
    upload_url: str = Header(alias="X-Co-Canvas-Upload-Url"),
    upload_offset: int = Header(alias="X-Goog-Upload-Offset", ge=0),
    upload_final: bool = Header(alias="X-Co-Canvas-Upload-Final"),
) -> VideoUploadChunkResponse:
    if project_id not in (None, "local") and user is None:
        raise HTTPException(status_code=401, detail="請先登入")

    chunk = await request.body()
    if not chunk or len(chunk) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="影片分段大小無效",
        )

    try:
        file_name = await forward_gemini_upload_chunk(
            upload_url,
            upload_offset,
            chunk,
            upload_final,
        )
    except GeminiUploadStartError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail=str(error),
        ) from error

    return VideoUploadChunkResponse(file_name=file_name)


@app.post("/api/file-uploads/start", response_model=VideoUploadStartResponse)
async def start_file_upload(
    request: FileUploadStartRequest,
    session: DatabaseSession,
    user: OptionalCurrentUser,
    project_id: ProjectId = None,
) -> VideoUploadStartResponse:
    runtime = await resolve_ai_api_key(project_id, user, session)
    if runtime.use_mock or runtime.api_key is None:
        raise HTTPException(status_code=503, detail="Gemini API Key 尚未設定")
    try:
        upload_url, chunk_size = await start_gemini_resumable_upload(
            runtime.api_key, request.file_name, request.mime_type, request.size
        )
    except GeminiUploadStartError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return VideoUploadStartResponse(upload_url=upload_url, chunk_size=chunk_size)


@app.post("/api/file-uploads/chunk", response_model=VideoUploadChunkResponse)
async def upload_file_chunk(
    request: Request,
    user: OptionalCurrentUser,
    project_id: ProjectId = None,
    upload_url: str = Header(alias="X-Co-Canvas-Upload-Url"),
    upload_offset: int = Header(alias="X-Goog-Upload-Offset", ge=0),
    upload_final: bool = Header(alias="X-Co-Canvas-Upload-Final"),
) -> VideoUploadChunkResponse:
    if project_id not in (None, "local") and user is None:
        raise HTTPException(status_code=401, detail="請先登入")
    chunk = await request.body()
    if not chunk or len(chunk) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="檔案分段大小無效")
    try:
        file_name = await forward_gemini_upload_chunk(upload_url, upload_offset, chunk, upload_final)
    except GeminiUploadStartError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    return VideoUploadChunkResponse(file_name=file_name)


@app.post(
    "/api/suggestions/generate",
    response_model=GenerateSuggestionApiResponse,
    response_model_exclude_none=True,
)
async def generate_suggestion(
    request: GenerateSuggestionRequest,
    session: DatabaseSession,
    user: OptionalCurrentUser,
    project_id: ProjectId = None,
) -> GenerateSuggestionApiResponse:
    runtime = await resolve_ai_api_key(
        project_id,
        user,
        session,
    )

    if runtime.use_mock:
        response = generate_with_mock(request)
        return GenerateSuggestionApiResponse(
            **response.model_dump(),
            ai_mode="mock",
            fallback_reason=runtime.fallback_reason,
        )

    response, fallback_reason = await run_gemini(
        generate_with_gemini(request, runtime.api_key),
        fallback=lambda: generate_with_mock(request),
    )

    if runtime.uses_user_key and user is not None:
        await update_user_key_status(
            session,
            user,
            "invalid" if fallback_reason == "invalid_key" else "valid",
        )

    return GenerateSuggestionApiResponse(
        **response.model_dump(),
        ai_mode="mock" if fallback_reason else "gemini",
        fallback_reason=fallback_reason,
    )
