from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient

import app.auth as auth_module
from app.database import get_database_session
from app.main import app


class DatabaseMustNotBeUsed:
    def __getattr__(self, name: str) -> Any:
        raise AssertionError(f"驗證失敗時不應操作資料庫：{name}")


@contextmanager
def auth_test_client() -> Iterator[TestClient]:
    async def override_database_session() -> AsyncIterator[DatabaseMustNotBeUsed]:
        yield DatabaseMustNotBeUsed()

    app.dependency_overrides[get_database_session] = override_database_session
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


def assert_unauthorized(response: Any, detail: str) -> None:
    assert response.status_code == 401
    assert response.json() == {"detail": detail}
    assert response.headers["www-authenticate"] == "Bearer"


def test_missing_bearer_token_is_rejected() -> None:
    with auth_test_client() as client:
        response = client.get("/api/projects")

    assert_unauthorized(response, "請先登入")


@pytest.mark.parametrize(
    "token_error",
    [
        jwt.InvalidSignatureError("偽造簽章"),
        jwt.ExpiredSignatureError("憑證已過期"),
    ],
    ids=["forged-token", "expired-token"],
)
def test_invalid_bearer_token_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
    token_error: jwt.InvalidTokenError,
) -> None:
    def reject_token(_token: str) -> dict[str, Any]:
        raise token_error

    monkeypatch.setattr(auth_module, "decode_token", reject_token)

    with auth_test_client() as client:
        response = client.get(
            "/api/projects",
            headers={"Authorization": "Bearer invalid-token"},
        )

    assert_unauthorized(response, "登入憑證無效或已過期")


def test_token_without_subject_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth_module,
        "decode_token",
        lambda _token: {"email": "user@example.com"},
    )

    with auth_test_client() as client:
        response = client.get(
            "/api/projects",
            headers={"Authorization": "Bearer missing-subject"},
        )

    assert_unauthorized(response, "登入憑證缺少使用者識別碼")


def test_invalid_token_is_not_treated_as_anonymous_on_public_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def reject_token(_token: str) -> dict[str, Any]:
        raise jwt.InvalidSignatureError("偽造簽章")

    monkeypatch.setattr(auth_module, "decode_token", reject_token)

    with auth_test_client() as client:
        response = client.get(
            "/api/projects/11111111-1111-4111-8111-111111111111",
            headers={"Authorization": "Bearer forged-token"},
        )

    assert_unauthorized(response, "登入憑證無效或已過期")
