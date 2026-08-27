import os
import uuid
from contextlib import contextmanager
from typing import Iterator

import psycopg
import pytest
from fastapi import HTTPException, status
from fastapi.testclient import TestClient
from psycopg.types.json import Jsonb

from app.auth import (
    AuthenticatedUser,
    get_current_user,
    get_optional_current_user,
)
from app.main import app


PRIVATE_PROJECT_ID = uuid.UUID("66666666-6666-4666-8666-666666666666")
PUBLIC_PROJECT_ID = uuid.UUID("77777777-7777-4777-8777-777777777777")
VIEWER_MEMBER_ID = uuid.UUID("88888888-8888-4888-8888-888888888888")
EDITOR_MEMBER_ID = uuid.UUID("99999999-9999-4999-8999-999999999999")

OWNER = AuthenticatedUser(id="postgres-owner", email="owner@example.com")
EDITOR = AuthenticatedUser(id="postgres-editor", email="editor@example.com")
VIEWER = AuthenticatedUser(id="postgres-viewer", email="viewer@example.com")

EMPTY_DOCUMENT = {
    "version": 4,
    "nodes": [],
    "edges": [],
    "messages": [],
    "suggestionEvents": [],
}


def get_test_database_url() -> str | None:
    if os.getenv("RUN_DATABASE_INTEGRATION_TESTS") != "1":
        return None

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "RUN_DATABASE_INTEGRATION_TESTS=1 時必須設定 DATABASE_URL",
        )

    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)


TEST_DATABASE_URL = get_test_database_url()


def seed_permission_projects(database_url: str) -> None:
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO projects (
                    id, owner_id, visibility, public_access_role, name, document
                ) VALUES
                    (%s, %s, 'private', 'viewer', %s, %s),
                    (%s, %s, 'public', 'viewer', %s, %s)
                """,
                (
                    PRIVATE_PROJECT_ID,
                    OWNER.id,
                    "PostgreSQL 私人權限測試",
                    Jsonb(EMPTY_DOCUMENT),
                    PUBLIC_PROJECT_ID,
                    OWNER.id,
                    "PostgreSQL 公開權限測試",
                    Jsonb(EMPTY_DOCUMENT),
                ),
            )
            cursor.execute(
                """
                INSERT INTO project_members (
                    id, project_id, user_id, email, role
                ) VALUES
                    (%s, %s, %s, %s, 'viewer'),
                    (%s, %s, %s, %s, 'editor')
                """,
                (
                    VIEWER_MEMBER_ID,
                    PRIVATE_PROJECT_ID,
                    VIEWER.id,
                    VIEWER.email,
                    EDITOR_MEMBER_ID,
                    PRIVATE_PROJECT_ID,
                    EDITOR.id,
                    EDITOR.email,
                ),
            )


def cleanup_permission_projects(database_url: str) -> None:
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM projects WHERE id IN (%s, %s)",
                (PRIVATE_PROJECT_ID, PUBLIC_PROJECT_ID),
            )


def get_project_state(
    database_url: str,
    project_id: uuid.UUID,
) -> tuple[str, str, object | None]:
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT name, visibility, deleted_at
                FROM projects
                WHERE id = %s
                """,
                (project_id,),
            )
            result = cursor.fetchone()

    assert result is not None
    return result


def get_research_event_count(
    database_url: str,
    project_id: uuid.UUID,
) -> int:
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT count(*) FROM research_events WHERE project_id = %s",
                (project_id,),
            )
            result = cursor.fetchone()

    assert result is not None
    return result[0]


@contextmanager
def authenticated_api_client() -> Iterator[
    tuple[TestClient, dict[str, AuthenticatedUser | None]]
]:
    active_user: dict[str, AuthenticatedUser | None] = {"value": OWNER}

    async def override_current_user() -> AuthenticatedUser:
        user = active_user["value"]
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="請先登入",
            )
        return user

    async def override_optional_current_user() -> AuthenticatedUser | None:
        return active_user["value"]

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_optional_current_user] = (
        override_optional_current_user
    )

    try:
        with TestClient(app) as client:
            yield client, active_user
    finally:
        app.dependency_overrides.clear()


@pytest.mark.skipif(
    TEST_DATABASE_URL is None,
    reason="只在隔離的 PostgreSQL CI 資料庫執行",
)
def test_postgres_enforces_project_roles_through_api() -> None:
    assert TEST_DATABASE_URL is not None
    cleanup_permission_projects(TEST_DATABASE_URL)
    seed_permission_projects(TEST_DATABASE_URL)

    try:
        with authenticated_api_client() as (client, active_user):
            active_user["value"] = VIEWER
            viewer_get = client.get(f"/api/projects/{PRIVATE_PROJECT_ID}")
            viewer_patch = client.patch(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
                json={"name": "viewer 不應能修改"},
            )
            viewer_delete = client.delete(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
            )

            assert viewer_get.status_code == 200
            assert viewer_get.json()["accessRole"] == "viewer"
            assert viewer_patch.status_code == 403
            assert viewer_delete.status_code == 404
            assert get_project_state(
                TEST_DATABASE_URL,
                PRIVATE_PROJECT_ID,
            ) == ("PostgreSQL 私人權限測試", "private", None)

            active_user["value"] = EDITOR
            editor_patch = client.patch(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
                json={"name": "editor 已更新內容"},
            )
            editor_permission_patch = client.patch(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
                json={"visibility": "public"},
            )
            editor_delete = client.delete(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
            )

            assert editor_patch.status_code == 200
            assert editor_permission_patch.status_code == 403
            assert editor_delete.status_code == 404
            assert get_project_state(
                TEST_DATABASE_URL,
                PRIVATE_PROJECT_ID,
            ) == ("editor 已更新內容", "private", None)

            active_user["value"] = None
            public_get = client.get(f"/api/projects/{PUBLIC_PROJECT_ID}")
            public_patch = client.patch(
                f"/api/projects/{PUBLIC_PROJECT_ID}",
                json={"name": "訪客不應能修改"},
            )

            assert public_get.status_code == 200
            assert public_get.json()["accessRole"] == "viewer"
            assert public_patch.status_code == 403
            assert get_project_state(
                TEST_DATABASE_URL,
                PUBLIC_PROJECT_ID,
            ) == ("PostgreSQL 公開權限測試", "public", None)

            active_user["value"] = OWNER
            owner_permission_patch = client.patch(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
                json={"visibility": "public"},
            )
            owner_delete = client.delete(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
            )

            assert owner_permission_patch.status_code == 200
            assert owner_delete.status_code == 204
            private_state = get_project_state(
                TEST_DATABASE_URL,
                PRIVATE_PROJECT_ID,
            )
            assert private_state[1] == "public"
            assert private_state[2] is not None
    finally:
        cleanup_permission_projects(TEST_DATABASE_URL)


@pytest.mark.skipif(
    TEST_DATABASE_URL is None,
    reason="只在隔離的 PostgreSQL CI 資料庫執行",
)
def test_postgres_records_and_exports_research_events() -> None:
    assert TEST_DATABASE_URL is not None
    cleanup_permission_projects(TEST_DATABASE_URL)
    seed_permission_projects(TEST_DATABASE_URL)
    document = {
        **EMPTY_DOCUMENT,
        "suggestionEvents": [
            {
                "id": "decision-1",
                "action": "accepted",
                "contextNodeId": "node-1",
                "aiMode": "gemini",
                "edited": True,
                "decisionTimeMs": 1234,
                "nodeCount": 2,
                "createdAt": "2026-08-27T04:00:00Z",
            }
        ],
    }

    try:
        with authenticated_api_client() as (client, active_user):
            first_save = client.patch(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
                json={"document": document},
            )
            second_save = client.patch(
                f"/api/projects/{PRIVATE_PROJECT_ID}",
                json={"document": document},
            )
            export_response = client.get(
                f"/api/projects/{PRIVATE_PROJECT_ID}/research-events/export"
            )

            assert first_save.status_code == 200
            assert second_save.status_code == 200
            assert get_research_event_count(
                TEST_DATABASE_URL,
                PRIVATE_PROJECT_ID,
            ) == 1
            assert export_response.status_code == 200
            assert "decision-1" in export_response.text
            assert export_response.content.startswith(b"\xef\xbb\xbf")

            active_user["value"] = VIEWER
            forbidden_export = client.get(
                f"/api/projects/{PRIVATE_PROJECT_ID}/research-events/export"
            )
            assert forbidden_export.status_code == 404
    finally:
        cleanup_permission_projects(TEST_DATABASE_URL)
