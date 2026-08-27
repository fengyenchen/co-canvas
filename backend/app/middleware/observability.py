import logging
import time
import uuid

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


logger = logging.getLogger("co_canvas.requests")
REQUEST_ID_HEADER = b"x-request-id"


class ObservabilityMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = self._get_request_id(scope)
        scope.setdefault("state", {})["request_id"] = request_id
        started_at = time.monotonic()
        status_code = 500
        response_started = False

        async def send_with_request_id(message: Message) -> None:
            nonlocal response_started, status_code
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER, request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            logger.exception(
                "request_failed request_id=%s method=%s path=%s",
                request_id,
                scope.get("method", ""),
                scope.get("path", ""),
            )
            if response_started:
                raise

            response = JSONResponse(
                {
                    "detail": "伺服器發生未預期錯誤",
                    "requestId": request_id,
                },
                status_code=500,
            )
            await response(scope, receive, send_with_request_id)
        finally:
            duration_ms = round((time.monotonic() - started_at) * 1000, 1)
            logger.info(
                "request_complete request_id=%s method=%s path=%s "
                "status=%s duration_ms=%s",
                request_id,
                scope.get("method", ""),
                scope.get("path", ""),
                status_code,
                duration_ms,
            )

    @staticmethod
    def _get_request_id(scope: Scope) -> str:
        for key, value in scope.get("headers", []):
            if key.lower() != REQUEST_ID_HEADER:
                continue

            candidate = value.decode("latin-1").strip()
            if (
                1 <= len(candidate) <= 100
                and candidate.isascii()
                and all(character.isalnum() or character in "-_" for character in candidate)
            ):
                return candidate

        return uuid.uuid4().hex
