from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.middleware.request_protection import RequestProtectionMiddleware


def create_test_app(
    *,
    api_requests: int = 2,
    ai_requests: int = 1,
    max_body_bytes: int = 32,
) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        RequestProtectionMiddleware,
        api_requests=api_requests,
        ai_requests=ai_requests,
        window_seconds=60,
        max_body_bytes=max_body_bytes,
    )

    @app.get("/api/projects")
    async def projects() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/api/chat")
    async def chat(request: Request) -> dict[str, int]:
        return {"size": len(await request.body())}

    @app.post("/api/echo")
    async def echo(request: Request) -> dict[str, int]:
        return {"size": len(await request.body())}

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    return app


def test_general_api_rate_limit_returns_retry_after() -> None:
    with TestClient(create_test_app()) as client:
        assert client.get("/api/projects").status_code == 200
        assert client.get("/api/projects").status_code == 200
        response = client.get("/api/projects")

    assert response.status_code == 429
    assert response.json() == {"detail": "請求過於頻繁，請稍後再試"}
    assert int(response.headers["retry-after"]) >= 1


def test_ai_endpoints_have_a_stricter_rate_limit() -> None:
    with TestClient(create_test_app()) as client:
        assert client.post("/api/chat", content=b"first").status_code == 200
        response = client.post("/api/chat", content=b"second")
        assert client.get("/api/projects").status_code == 200

    assert response.status_code == 429


def test_rate_limit_is_separated_by_forwarded_client_ip() -> None:
    with TestClient(create_test_app(api_requests=1)) as client:
        first = client.get(
            "/api/projects",
            headers={"X-Forwarded-For": "203.0.113.1"},
        )
        second_client = client.get(
            "/api/projects",
            headers={"X-Forwarded-For": "203.0.113.2"},
        )

    assert first.status_code == 200
    assert second_client.status_code == 200


def test_request_body_at_limit_is_replayed_to_endpoint() -> None:
    body = b"x" * 32
    with TestClient(create_test_app()) as client:
        response = client.post("/api/echo", content=body)

    assert response.status_code == 200
    assert response.json() == {"size": 32}


def test_oversized_request_body_is_rejected() -> None:
    with TestClient(create_test_app()) as client:
        response = client.post("/api/echo", content=b"x" * 33)

    assert response.status_code == 413
    assert response.json() == {"detail": "請求內容超過允許大小"}


def test_health_and_preflight_requests_are_not_rate_limited() -> None:
    with TestClient(create_test_app(api_requests=1)) as client:
        for _ in range(3):
            assert client.get("/health").status_code == 200
        assert client.options("/api/projects").status_code != 429
