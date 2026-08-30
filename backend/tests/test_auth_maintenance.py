import asyncio
import base64
import json
from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
from fastapi.testclient import TestClient
from pydantic import SecretStr
from svix.webhooks import Webhook

import app.routers.auth_maintenance as router_module
from app.database import get_database_session
from app.main import app
from app.services.auth_maintenance import AuthUserRecord, delete_neon_auth_user
from app.settings import Settings


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []

    async def get(self, _model: object, _key: object) -> None:
        return None

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None


@contextmanager
def maintenance_client(session: FakeSession) -> Iterator[TestClient]:
    async def override_session() -> AsyncIterator[FakeSession]:
        yield session

    app.dependency_overrides[get_database_session] = override_session
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


def permanent_bounce_event(email: str) -> dict[str, object]:
    return {
        "type": "email.bounced",
        "data": {
            "to": [email],
            "bounce": {"type": "Permanent"},
        },
    }


def webhook_headers() -> dict[str, str]:
    return {
        "svix-id": "msg_test",
        "svix-timestamp": "1788100000",
        "svix-signature": "v1,test",
    }


def test_resend_signature_is_verified_against_raw_body(monkeypatch) -> None:
    secret = "whsec_" + base64.b64encode(b"x" * 32).decode()
    body = json.dumps(
        permanent_bounce_event("bounce@example.com"),
        separators=(",", ":"),
    )
    timestamp = datetime.now(timezone.utc)
    signature = Webhook(secret).sign("msg_signed", timestamp, body)
    monkeypatch.setattr(
        router_module,
        "get_settings",
        lambda: SimpleNamespace(resend_webhook_secret=SecretStr(secret)),
    )

    event = router_module._parse_resend_event(
        body.encode(),
        {
            "svix-id": "msg_signed",
            "svix-timestamp": str(int(timestamp.timestamp())),
            "svix-signature": signature,
        },
    )

    assert event["type"] == "email.bounced"


def test_permanent_bounce_never_deletes_verified_user(monkeypatch) -> None:
    session = FakeSession()
    verified = AuthUserRecord(
        id="verified-user",
        email="verified@example.com",
        email_verified=True,
        created_at=datetime.now(timezone.utc) - timedelta(days=3),
    )
    delete_user = AsyncMock()
    monkeypatch.setattr(
        router_module,
        "_parse_resend_event",
        lambda _body, _headers: permanent_bounce_event(verified.email),
    )
    monkeypatch.setattr(
        router_module,
        "find_auth_user_by_email",
        AsyncMock(return_value=verified),
    )
    monkeypatch.setattr(router_module, "delete_neon_auth_user", delete_user)

    with maintenance_client(session) as client:
        response = client.post(
            "/api/webhooks/resend",
            content=b"{}",
            headers=webhook_headers(),
        )

    assert response.status_code == 200
    assert response.json()["verifiedIgnored"] == 1
    delete_user.assert_not_awaited()


def test_permanent_bounce_rechecks_then_deletes_unverified_user(monkeypatch) -> None:
    session = FakeSession()
    unverified = AuthUserRecord(
        id="unverified-user",
        email="missing@example.com",
        email_verified=False,
        created_at=datetime.now(timezone.utc),
    )
    delete_user = AsyncMock(return_value=True)
    monkeypatch.setattr(
        router_module,
        "_parse_resend_event",
        lambda _body, _headers: permanent_bounce_event(unverified.email),
    )
    monkeypatch.setattr(
        router_module,
        "find_auth_user_by_email",
        AsyncMock(return_value=unverified),
    )
    find_by_id = AsyncMock(return_value=unverified)
    monkeypatch.setattr(router_module, "find_auth_user_by_id", find_by_id)
    monkeypatch.setattr(router_module, "delete_neon_auth_user", delete_user)

    with maintenance_client(session) as client:
        response = client.post(
            "/api/webhooks/resend",
            content=b"{}",
            headers=webhook_headers(),
        )

    assert response.status_code == 200
    assert response.json()["deleted"] == 1
    find_by_id.assert_awaited_once()
    delete_user.assert_awaited_once()
    assert len(session.added) == 1


def test_cleanup_skips_user_verified_after_candidate_query(monkeypatch) -> None:
    session = FakeSession()
    old_unverified = AuthUserRecord(
        id="race-user",
        email="race@example.com",
        email_verified=False,
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
    )
    now_verified = AuthUserRecord(
        id=old_unverified.id,
        email=old_unverified.email,
        email_verified=True,
        created_at=old_unverified.created_at,
    )
    settings = SimpleNamespace(
        auth_cleanup_secret=SecretStr("cleanup-secret"),
        auth_unverified_retention_hours=24,
        auth_cleanup_batch_size=100,
    )
    delete_user = AsyncMock()
    monkeypatch.setattr(router_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        router_module,
        "list_expired_unverified_users",
        AsyncMock(return_value=[old_unverified]),
    )
    monkeypatch.setattr(
        router_module,
        "find_auth_user_by_id",
        AsyncMock(return_value=now_verified),
    )
    monkeypatch.setattr(router_module, "delete_neon_auth_user", delete_user)

    with maintenance_client(session) as client:
        response = client.post(
            "/api/internal/auth/cleanup-unverified",
            headers={"X-Cleanup-Secret": "cleanup-secret"},
        )

    assert response.status_code == 200
    assert response.json() == {
        "status": "completed",
        "candidates": 1,
        "deleted": 0,
        "skipped": 1,
    }
    delete_user.assert_not_awaited()


def test_neon_delete_uses_control_api_and_treats_404_as_missing() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(404)

    settings = Settings(
        _env_file=None,
        neon_api_key="neon-secret",
        neon_project_id="project-id",
        neon_branch_id="branch-id",
    )
    async def run() -> bool:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler)
        ) as client:
            return await delete_neon_auth_user("user/id", settings, client)

    deleted = asyncio.run(run())

    assert deleted is False
    assert requests[0].url.raw_path.endswith(b"/auth/users/user%2Fid")
    assert requests[0].headers["authorization"] == "Bearer neon-secret"
