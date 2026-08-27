from unittest.mock import AsyncMock
from types import SimpleNamespace

from fastapi.testclient import TestClient

import app.main as main_module


def test_liveness_does_not_depend_on_external_services() -> None:
    with TestClient(main_module.app) as client:
        response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-request-id"]


def test_readiness_reports_healthy_dependencies(monkeypatch) -> None:
    monkeypatch.setattr(
        main_module,
        "get_settings",
        lambda: SimpleNamespace(database_url=object(), neon_auth_jwks_url=object()),
    )
    monkeypatch.setattr(
        main_module,
        "check_database_connection",
        AsyncMock(return_value=True),
    )

    with TestClient(main_module.app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["checks"] == {"database": True, "auth": True}


def test_readiness_returns_503_when_database_is_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(
        main_module,
        "get_settings",
        lambda: SimpleNamespace(database_url=object(), neon_auth_jwks_url=object()),
    )
    monkeypatch.setattr(
        main_module,
        "check_database_connection",
        AsyncMock(side_effect=main_module.DatabaseConnectionError),
    )

    with TestClient(main_module.app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["status"] == "not_ready"
    assert response.json()["checks"]["database"] is False
