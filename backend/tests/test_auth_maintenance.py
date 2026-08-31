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
from app.auth import AuthenticatedUser, get_current_user
from app.main import app
from app.models import AuthAccountEvent
from app.services.auth_email import send_welcome_email
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

    async def scalar(self, _statement: object) -> None:
        return None

    async def scalars(self, _statement: object) -> SimpleNamespace:
        return SimpleNamespace(all=lambda: [])


@contextmanager
def maintenance_client(
    session: FakeSession,
    user: AuthenticatedUser | None = None,
) -> Iterator[TestClient]:
    async def override_session() -> AsyncIterator[FakeSession]:
        yield session

    app.dependency_overrides[get_database_session] = override_session
    if user is not None:
        app.dependency_overrides[get_current_user] = lambda: user
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
    assert len(session.added) == 2
    audit_event = next(
        value for value in session.added if isinstance(value, AuthAccountEvent)
    )
    assert audit_event.event_type == "cleanup_permanent_bounce"
    assert audit_event.email_hash != unverified.email
    assert len(audit_event.email_hash) == 64


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


def test_cleanup_records_anonymous_expired_account_event(monkeypatch) -> None:
    session = FakeSession()
    expired = AuthUserRecord(
        id="expired-user",
        email="expired@example.com",
        email_verified=False,
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
    )
    settings = SimpleNamespace(
        auth_cleanup_secret=SecretStr("cleanup-secret"),
        auth_audit_hash_secret=SecretStr("audit-secret"),
        auth_unverified_retention_hours=24,
        auth_cleanup_batch_size=100,
    )
    monkeypatch.setattr(router_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        router_module,
        "list_expired_unverified_users",
        AsyncMock(return_value=[expired]),
    )
    monkeypatch.setattr(
        router_module,
        "find_auth_user_by_id",
        AsyncMock(return_value=expired),
    )
    monkeypatch.setattr(
        router_module,
        "delete_neon_auth_user",
        AsyncMock(return_value=True),
    )

    with maintenance_client(session) as client:
        response = client.post(
            "/api/internal/auth/cleanup-unverified",
            headers={"X-Cleanup-Secret": "cleanup-secret"},
        )

    assert response.status_code == 200
    event = next(
        value for value in session.added if isinstance(value, AuthAccountEvent)
    )
    assert event.event_type == "cleanup_expired"
    assert event.email_hash != expired.email
    assert len(event.email_hash) == 64


def test_verified_user_receives_welcome_email_once(monkeypatch) -> None:
    session = FakeSession()
    verified = AuthUserRecord(
        id="verified-user",
        email="verified@example.com",
        email_verified=True,
        created_at=datetime.now(timezone.utc),
    )
    settings = SimpleNamespace(
        auth_cleanup_secret=SecretStr("cleanup-secret"),
        auth_audit_hash_secret=SecretStr("audit-secret"),
    )
    monkeypatch.setattr(router_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        router_module,
        "find_auth_user_by_id",
        AsyncMock(return_value=verified),
    )
    send_email = AsyncMock(return_value="email-message-id")
    monkeypatch.setattr(router_module, "send_welcome_email", send_email)
    user = AuthenticatedUser(
        id=verified.id,
        email=verified.email,
        name="測試使用者",
    )

    with maintenance_client(session, user) as client:
        response = client.post("/api/auth/welcome")

    assert response.status_code == 200
    assert response.json() == {"status": "sent"}
    send_email.assert_awaited_once()
    welcome_event = next(
        value for value in session.added if isinstance(value, AuthAccountEvent)
    )
    assert welcome_event.event_type == "welcome_sent"
    assert welcome_event.provider_message_id == "email-message-id"


def test_welcome_email_uses_resend_idempotency_key() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"id": "resend-id"})

    settings = Settings(
        _env_file=None,
        resend_api_key="resend-secret",
        resend_from_email="Co-Canvas <hello@example.com>",
        app_public_url="https://canvas.example.com",
    )

    async def run() -> str:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler)
        ) as client:
            return await send_welcome_email(
                "user@example.com",
                "使用者",
                "user-hash",
                settings,
                client,
            )

    assert asyncio.run(run()) == "resend-id"
    assert requests[0].headers["idempotency-key"] == (
        "co-canvas-welcome-user-hash"
    )
    assert "user@example.com" in requests[0].content.decode()


def test_admin_can_view_verified_and_waiting_statuses(monkeypatch) -> None:
    session = FakeSession()
    now = datetime.now(timezone.utc)
    users = [
        AuthUserRecord(
            id="verified",
            email="verified@example.com",
            email_verified=True,
            created_at=now,
        ),
        AuthUserRecord(
            id="waiting",
            email="waiting@example.com",
            email_verified=False,
            created_at=now,
        ),
    ]
    monkeypatch.setattr(
        router_module,
        "get_settings",
        lambda: SimpleNamespace(auth_admin_email_set={"admin@example.com"}),
    )
    monkeypatch.setattr(
        router_module,
        "list_auth_users",
        AsyncMock(return_value=users),
    )
    admin = AuthenticatedUser(
        id="admin",
        email="admin@example.com",
        name="管理者",
    )

    with maintenance_client(session, admin) as client:
        response = client.get("/api/admin/auth/accounts")

    assert response.status_code == 200
    assert response.json()["counts"] == {
        "verified": 1,
        "waiting": 1,
        "permanentBounce": 0,
    }
    assert [account["status"] for account in response.json()["accounts"]] == [
        "verified",
        "waiting",
    ]


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
