import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import AsyncIterator, Iterator, Literal

import pytest
from fastapi.testclient import TestClient

from app.auth import (
    AuthenticatedUser,
    get_current_user,
    get_optional_current_user,
)
from app.database import get_database_session
from app.main import app
from app.models import Project


PROJECT_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")
OWNER = AuthenticatedUser(
    id="owner-user",
    email="owner@example.com",
    name="Owner User",
)
EDITOR = AuthenticatedUser(
    id="editor-user",
    email="editor@example.com",
    name="Editor User",
)
VIEWER = AuthenticatedUser(
    id="viewer-user",
    email="viewer@example.com",
    name="Viewer User",
)


class FakeProjectSession:
    def __init__(
        self,
        project: Project,
        *,
        member_role: Literal["editor", "viewer"] | None = None,
        owner_lookup_allowed: bool = False,
    ) -> None:
        self.project = project
        self.member_role = member_role
        self.owner_lookup_allowed = owner_lookup_allowed
        self.commit_count = 0
        self.execute_count = 0
        self.rollback_count = 0

    async def get(self, model: type[Project], project_id: uuid.UUID) -> Project | None:
        assert model is Project
        return self.project if project_id == self.project.id else None

    async def scalar(self, _statement: object) -> Project | str | None:
        if self.member_role is not None:
            return self.member_role
        return self.project if self.owner_lookup_allowed else None

    async def execute(self, _statement: object) -> None:
        self.execute_count += 1

    async def commit(self) -> None:
        self.commit_count += 1

    async def rollback(self) -> None:
        self.rollback_count += 1

    async def refresh(self, _instance: object) -> None:
        return None


def create_project(
    *,
    visibility: Literal["private", "public"] = "private",
    public_access_role: Literal["editor", "viewer"] = "viewer",
) -> Project:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return Project(
        id=PROJECT_ID,
        owner_id=OWNER.id,
        visibility=visibility,
        public_access_role=public_access_role,
        name="權限整合測試",
        document={
            "version": 4,
            "nodes": [],
            "edges": [],
            "messages": [],
            "suggestionEvents": [],
        },
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )


@contextmanager
def api_client(
    session: FakeProjectSession,
    user: AuthenticatedUser | None,
) -> Iterator[TestClient]:
    async def override_database_session() -> AsyncIterator[FakeProjectSession]:
        yield session

    async def override_current_user() -> AuthenticatedUser:
        assert user is not None
        return user

    async def override_optional_current_user() -> AuthenticatedUser | None:
        return user

    app.dependency_overrides[get_database_session] = override_database_session
    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_optional_current_user] = (
        override_optional_current_user
    )

    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("visibility", "user", "member_role"),
    [
        ("private", VIEWER, "viewer"),
        ("public", None, None),
    ],
)
def test_viewer_cannot_patch_project(
    visibility: Literal["private", "public"],
    user: AuthenticatedUser | None,
    member_role: Literal["viewer"] | None,
) -> None:
    project = create_project(visibility=visibility)
    session = FakeProjectSession(project, member_role=member_role)

    with api_client(session, user) as client:
        response = client.patch(
            f"/api/projects/{PROJECT_ID}",
            json={"name": "viewer 不應能修改"},
        )

    assert response.status_code == 403
    assert response.json() == {"detail": "你只有檢視權限"}
    assert project.name == "權限整合測試"
    assert session.commit_count == 0


@pytest.mark.parametrize("user", [EDITOR, VIEWER])
def test_non_owner_cannot_delete_project(user: AuthenticatedUser) -> None:
    project = create_project()
    session = FakeProjectSession(project, owner_lookup_allowed=False)

    with api_client(session, user) as client:
        response = client.delete(f"/api/projects/{PROJECT_ID}")

    assert response.status_code == 404
    assert response.json() == {"detail": "找不到此專案"}
    assert project.deleted_at is None
    assert session.commit_count == 0


def test_owner_can_mark_project_viewed_without_updating_project() -> None:
    project = create_project()
    original_updated_at = project.updated_at
    session = FakeProjectSession(project)

    with api_client(session, OWNER) as client:
        response = client.post(f"/api/projects/{PROJECT_ID}/view")

    assert response.status_code == 204
    assert session.execute_count == 1
    assert session.commit_count == 1
    assert project.updated_at == original_updated_at


def test_viewer_can_remove_project_from_personal_list() -> None:
    project = create_project()
    session = FakeProjectSession(project, member_role="viewer")

    with api_client(session, VIEWER) as client:
        response = client.delete(
            f"/api/projects/{PROJECT_ID}/list-entry"
        )

    assert response.status_code == 204
    assert session.execute_count == 1
    assert session.commit_count == 1
    assert project.deleted_at is None


def test_owner_cannot_remove_owned_project_from_personal_list() -> None:
    project = create_project()
    session = FakeProjectSession(project)

    with api_client(session, OWNER) as client:
        response = client.delete(
            f"/api/projects/{PROJECT_ID}/list-entry"
        )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "擁有者請使用垃圾桶管理自己的專案"
    }
    assert session.execute_count == 0
    assert session.commit_count == 0


def test_editor_can_patch_content_but_cannot_change_permissions() -> None:
    project = create_project()
    session = FakeProjectSession(project, member_role="editor")

    with api_client(session, EDITOR) as client:
        content_response = client.patch(
            f"/api/projects/{PROJECT_ID}",
            json={"name": "editor 可以修改內容"},
        )
        permission_response = client.patch(
            f"/api/projects/{PROJECT_ID}",
            json={"visibility": "public"},
        )

    assert content_response.status_code == 200
    assert content_response.json()["name"] == "editor 可以修改內容"
    assert permission_response.status_code == 403
    assert permission_response.json() == {
        "detail": "只有擁有者可以變更專案權限",
    }
    assert project.visibility == "private"
    assert session.commit_count == 1


def test_backend_stamps_and_preserves_chat_message_author() -> None:
    project = create_project()
    session = FakeProjectSession(project, member_role="editor")
    document = {
        **project.document,
        "messages": [
            {
                "id": "message-1",
                "role": "user",
                "content": "其他使用者訊息",
                "contextNodeId": None,
                "createdAt": "2026-08-28T00:00:00.000Z",
                "authorId": "spoofed-user",
                "authorEmail": "spoofed@example.com",
                "authorName": "Spoofed User",
            }
        ],
    }

    with api_client(session, EDITOR) as client:
        first_response = client.patch(
            f"/api/projects/{PROJECT_ID}",
            json={"document": document},
        )
        document["messages"][0]["content"] = "編輯後訊息"
        document["messages"][0]["authorId"] = OWNER.id
        document["messages"][0]["authorEmail"] = OWNER.email
        document["messages"][0]["authorName"] = OWNER.name
        second_response = client.patch(
            f"/api/projects/{PROJECT_ID}",
            json={"document": document},
        )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    saved_message = second_response.json()["document"]["messages"][0]
    assert saved_message["id"] == "message-1"
    assert saved_message["content"] == "編輯後訊息"
    assert saved_message["authorId"] == EDITOR.id
    assert saved_message["authorEmail"] == EDITOR.email
    assert saved_message["authorName"] == EDITOR.name


def test_anonymous_public_editor_cannot_spoof_chat_author() -> None:
    project = create_project(
        visibility="public",
        public_access_role="editor",
    )
    session = FakeProjectSession(project)
    document = {
        **project.document,
        "messages": [
            {
                "id": "anonymous-message",
                "role": "user",
                "content": "公開使用者訊息",
                "contextNodeId": None,
                "createdAt": "2026-08-29T00:00:00.000Z",
                "authorId": OWNER.id,
                "authorEmail": OWNER.email,
                "authorName": OWNER.name,
            }
        ],
    }

    with api_client(session, None) as client:
        response = client.patch(
            f"/api/projects/{PROJECT_ID}",
            json={"document": document},
        )

    assert response.status_code == 200
    saved_message = project.document["messages"][0]
    assert "authorId" not in saved_message
    assert "authorEmail" not in saved_message
    assert "authorName" not in saved_message


def test_owner_can_patch_and_delete_project() -> None:
    project = create_project()
    session = FakeProjectSession(project, owner_lookup_allowed=True)

    with api_client(session, OWNER) as client:
        patch_response = client.patch(
            f"/api/projects/{PROJECT_ID}",
            json={"name": "owner 已更新"},
        )
        delete_response = client.delete(f"/api/projects/{PROJECT_ID}")

    assert patch_response.status_code == 200
    assert patch_response.json()["name"] == "owner 已更新"
    assert delete_response.status_code == 204
    assert project.deleted_at is not None
    assert session.commit_count == 2
