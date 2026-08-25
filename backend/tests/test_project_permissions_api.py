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
OWNER = AuthenticatedUser(id="owner-user", email="owner@example.com")
EDITOR = AuthenticatedUser(id="editor-user", email="editor@example.com")
VIEWER = AuthenticatedUser(id="viewer-user", email="viewer@example.com")


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
        self.rollback_count = 0

    async def get(self, model: type[Project], project_id: uuid.UUID) -> Project | None:
        assert model is Project
        return self.project if project_id == self.project.id else None

    async def scalar(self, _statement: object) -> Project | str | None:
        if self.member_role is not None:
            return self.member_role
        return self.project if self.owner_lookup_allowed else None

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
