import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import AuthenticatedUser, CurrentUser, OptionalCurrentUser
from app.database import get_database_session
from app.models import Project, ProjectMember
from app.project_schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectRole,
    ProjectSummary,
    ProjectUpdate,
)


router = APIRouter(
    prefix="/api/projects",
    tags=["projects"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_database_session),
]


async def get_project_or_404(
    project_id: uuid.UUID,
    session: AsyncSession,
    owner_id: str,
) -> Project:
    project = await session.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == owner_id,
        ),
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此專案",
        )

    return project


async def get_readable_project(
    project_id: uuid.UUID,
    session: AsyncSession,
    user: OptionalCurrentUser,
) -> tuple[Project, ProjectRole]:
    project = await session.get(Project, project_id)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此專案",
        )

    role = await get_project_role(project, session, user)

    if role is not None:
        return project, role

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="請先登入以查看此專案",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="你沒有查看此專案的權限",
    )


async def get_project_role(
    project: Project,
    session: AsyncSession,
    user: AuthenticatedUser | None,
) -> ProjectRole | None:
    if user is not None and project.owner_id == user.id:
        return "owner"

    if user is not None:
        member_filters = [ProjectMember.user_id == user.id]

        if user.email is not None:
            member_filters.append(
                func.lower(ProjectMember.email) == user.email,
            )

        member_role = await session.scalar(
            select(ProjectMember.role).where(
                ProjectMember.project_id == project.id,
                or_(*member_filters),
            ),
        )

        if member_role in ("editor", "viewer"):
            return member_role

    if project.visibility == "public":
        return project.public_access_role

    return None


def to_project_summary(
    project: Project,
    access_role: ProjectRole,
) -> ProjectSummary:
    return ProjectSummary(
        id=project.id,
        name=project.name,
        visibility=project.visibility,
        public_access_role=project.public_access_role,
        access_role=access_role,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def to_project_response(
    project: Project,
    access_role: ProjectRole,
) -> ProjectResponse:
    return ProjectResponse(
        **to_project_summary(project, access_role).model_dump(),
        document=project.document,
    )


@router.get("", response_model=list[ProjectSummary])
async def list_projects(
    session: DatabaseSession,
    user: CurrentUser,
) -> list[ProjectSummary]:
    result = await session.scalars(
        select(Project)
        .where(Project.owner_id == user.id)
        .order_by(Project.updated_at.desc())
        .limit(100),
    )

    return [to_project_summary(project, "owner") for project in result]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: OptionalCurrentUser,
) -> ProjectResponse:
    project, role = await get_readable_project(project_id, session, user)
    return to_project_response(project, role)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    request: ProjectUpdate,
    session: DatabaseSession,
    user: OptionalCurrentUser,
) -> ProjectResponse:
    project, role = await get_readable_project(project_id, session, user)

    if role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="你只有檢視權限",
        )

    if (
        role != "owner"
        and (
            request.visibility is not None
            or request.public_access_role is not None
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有擁有者可以變更專案權限",
        )

    if request.name is not None:
        project.name = request.name

    if request.document is not None:
        project.document = request.document.model_dump(by_alias=True)

    if request.visibility is not None:
        project.visibility = request.visibility

    if request.public_access_role is not None:
        project.public_access_role = request.public_access_role

    await session.commit()
    await session.refresh(project)

    return to_project_response(project, role)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_project(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: CurrentUser,
) -> Response:
    project = await get_project_or_404(project_id, session, user.id)

    await session.delete(project)
    await session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    request: ProjectCreate,
    session: DatabaseSession,
    user: CurrentUser,
) -> ProjectResponse:
    project = Project(
        owner_id=user.id,
        name=request.name.strip(),
        document=request.document.model_dump(by_alias=True),
        visibility=request.visibility,
        public_access_role=request.public_access_role,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)

    return to_project_response(project, "owner")
