from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.observability import ObservabilityMiddleware


def create_test_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(ObservabilityMiddleware)

    @app.get("/ok")
    async def ok() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("sensitive internal detail")

    return app


def test_adds_generated_request_id_to_response() -> None:
    with TestClient(create_test_app()) as client:
        response = client.get("/ok")

    assert response.status_code == 200
    assert len(response.headers["x-request-id"]) == 32


def test_preserves_valid_incoming_request_id() -> None:
    with TestClient(create_test_app()) as client:
        response = client.get("/ok", headers={"X-Request-ID": "client-123"})

    assert response.headers["x-request-id"] == "client-123"


def test_replaces_invalid_incoming_request_id() -> None:
    with TestClient(create_test_app()) as client:
        response = client.get("/ok", headers={"X-Request-ID": "invalid id!"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] != "invalid id!"


def test_unhandled_error_returns_safe_message_and_request_id() -> None:
    with TestClient(create_test_app(), raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    assert response.json() == {
        "detail": "伺服器發生未預期錯誤",
        "requestId": response.headers["x-request-id"],
    }
    assert "sensitive internal detail" not in response.text
