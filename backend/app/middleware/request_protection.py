import asyncio
import time
from dataclasses import dataclass

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


AI_PATHS = frozenset({
    "/api/chat",
    "/api/suggestions/generate",
    "/api/video-uploads/start",
})
UPLOAD_PATHS = frozenset({"/api/video-uploads/chunk"})
UPLOAD_MAX_BODY_BYTES = 8 * 1024 * 1024
BODY_METHODS = frozenset({"POST", "PUT", "PATCH"})


@dataclass
class RateLimitEntry:
    count: int
    window_started_at: float


class RequestProtectionMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        api_requests: int,
        ai_requests: int,
        window_seconds: int,
        max_body_bytes: int,
    ) -> None:
        self.app = app
        self.api_requests = api_requests
        self.ai_requests = ai_requests
        self.window_seconds = window_seconds
        self.max_body_bytes = max_body_bytes
        self.entries: dict[tuple[str, str], RateLimitEntry] = {}
        self.lock = asyncio.Lock()

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "GET")

        if path.startswith("/api/") and method != "OPTIONS":
            if path in UPLOAD_PATHS:
                group = "upload"
                limit = max(600, self.api_requests * 5)
            else:
                group = "ai" if path in AI_PATHS else "api"
                limit = self.ai_requests if group == "ai" else self.api_requests
            retry_after = await self._check_rate_limit(
                self._get_client_identifier(scope),
                group,
                limit,
            )
            if retry_after is not None:
                response = JSONResponse(
                    {"detail": "請求過於頻繁，請稍後再試"},
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                )
                await response(scope, receive, send)
                return

        if path.startswith("/api/") and method in BODY_METHODS:
            max_body_bytes = (
                UPLOAD_MAX_BODY_BYTES
                if path in UPLOAD_PATHS
                else self.max_body_bytes
            )
            content_length = self._get_content_length(scope)
            if content_length is not None and content_length > max_body_bytes:
                await self._send_body_too_large(scope, receive, send)
                return

            body = await self._read_body(receive, max_body_bytes)
            if body is None:
                await self._send_body_too_large(scope, receive, send)
                return

            receive = self._replay_body(body)

        await self.app(scope, receive, send)

    async def _check_rate_limit(
        self,
        client_identifier: str,
        group: str,
        limit: int,
    ) -> int | None:
        now = time.monotonic()
        key = (client_identifier, group)

        async with self.lock:
            entry = self.entries.get(key)
            if entry is None or now - entry.window_started_at >= self.window_seconds:
                self.entries[key] = RateLimitEntry(1, now)
                return None

            if entry.count >= limit:
                remaining = self.window_seconds - (now - entry.window_started_at)
                return max(1, int(remaining) + 1)

            entry.count += 1
            return None

    async def _read_body(
        self,
        receive: Receive,
        max_body_bytes: int,
    ) -> bytes | None:
        chunks: list[bytes] = []
        total_bytes = 0

        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return b""

            chunk = message.get("body", b"")
            total_bytes += len(chunk)
            if total_bytes > max_body_bytes:
                return None
            chunks.append(chunk)

            if not message.get("more_body", False):
                return b"".join(chunks)

    @staticmethod
    def _replay_body(body: bytes) -> Receive:
        delivered = False

        async def receive() -> Message:
            nonlocal delivered
            if delivered:
                return {"type": "http.disconnect"}
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}

        return receive

    async def _send_body_too_large(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        response = JSONResponse(
            {"detail": "請求內容超過允許大小"},
            status_code=413,
        )
        await response(scope, receive, send)

    @staticmethod
    def _get_client_identifier(scope: Scope) -> str:
        headers = {
            key.lower(): value
            for key, value in scope.get("headers", [])
        }
        forwarded_for = headers.get(b"x-forwarded-for")
        if forwarded_for:
            return forwarded_for.decode("latin-1").split(",", 1)[0].strip()

        client = scope.get("client")
        return client[0] if client else "unknown"

    @staticmethod
    def _get_content_length(scope: Scope) -> int | None:
        for key, value in scope.get("headers", []):
            if key.lower() == b"content-length":
                try:
                    return int(value)
                except ValueError:
                    return None
        return None
