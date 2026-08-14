from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_database_session
from app.models import Project
from app.project_schemas import ProjectCreate, ProjectResponse


router = APIRouter(
    prefix="/api/projects",
    tags=["projects"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_database_session),
]


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
