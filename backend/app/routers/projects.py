import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.database import get_database_session
from app.models import Project
from app.project_schemas import (
    ProjectCreate,
    ProjectResponse,
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


@router.get("", response_model=list[ProjectSummary])
async def list_projects(
    session: DatabaseSession,
    user: CurrentUser,
) -> list[Project]:
    result = await session.scalars(
        select(Project)
        .where(Project.owner_id == user.id)
        .order_by(Project.updated_at.desc())
        .limit(100),
    )

    return list(result)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: CurrentUser,
) -> Project:
    return await get_project_or_404(project_id, session, user.id)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    request: ProjectUpdate,
    session: DatabaseSession,
    user: CurrentUser,
) -> Project:
    project = await get_project_or_404(project_id, session, user.id)

    if request.name is not None:
        project.name = request.name

    if request.document is not None:
        project.document = request.document.model_dump(by_alias=True)

    if request.visibility is not None:
        project.visibility = request.visibility

    await session.commit()
    await session.refresh(project)

    return project


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
) -> Project:
    project = Project(
        owner_id=user.id,
        name=request.name.strip(),
        document=request.document.model_dump(by_alias=True),
        visibility=request.visibility,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)

    return project
