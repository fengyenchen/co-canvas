from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models import Project
from app.project_schemas import (
    ProjectCreate,
    ProjectResponse,
    ProjectSummary,
)


router = APIRouter(
    prefix="/api/projects",
    tags=["projects"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_database_session),
]


@router.get("", response_model=list[ProjectSummary])
async def list_projects(session: DatabaseSession) -> list[Project]:
    result = await session.scalars(
        select(Project).order_by(Project.updated_at.desc()).limit(100),
    )

    return list(result)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    request: ProjectCreate,
    session: DatabaseSession,
) -> Project:
    project = Project(
        name=request.name.strip(),
        document=request.document.model_dump(by_alias=True),
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)

    return project
