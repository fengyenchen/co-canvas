import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import AuthenticatedUser, CurrentUser, OptionalCurrentUser
from app.database import get_database_session
from app.models import Project, ProjectMember, ProjectVersion
from app.project_schemas import (
    ProjectCreate,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectMemberUpdate,
    ProjectResponse,
    ProjectRole,
    ProjectSummary,
    ProjectUpdate,
    ProjectVersionCreate,
    ProjectVersionResponse,
    ProjectVersionRestore,
    ProjectVersionSummary,
    TrashedProjectSummary,
)


router = APIRouter(
    prefix="/api/projects",
    tags=["projects"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_database_session),
]

TRASH_RETENTION_DAYS = 30


async def get_project_or_404(
    project_id: uuid.UUID,
    session: AsyncSession,
    owner_id: str,
) -> Project:
    project = await session.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == owner_id,
            Project.deleted_at.is_(None),
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

    if project is None or project.deleted_at is not None:
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

    if project.visibility == "public":
        return project.public_access_role

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


async def get_project_member_or_404(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    session: AsyncSession,
) -> ProjectMember:
    member = await session.scalar(
        select(ProjectMember).where(
            ProjectMember.id == member_id,
            ProjectMember.project_id == project_id,
        ),
    )

    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此專案成員",
        )

    return member


async def get_project_version_or_404(
    project_id: uuid.UUID,
    version_id: uuid.UUID,
    session: AsyncSession,
) -> ProjectVersion:
    version = await session.scalar(
        select(ProjectVersion).where(
            ProjectVersion.id == version_id,
            ProjectVersion.project_id == project_id,
        )
    )

    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="找不到此版本紀錄",
        )

    return version


def to_project_version_summary(
    version: ProjectVersion,
) -> ProjectVersionSummary:
    return ProjectVersionSummary(
        id=version.id,
        name=version.name,
        kind=version.kind,
        created_at=version.created_at,
    )


def to_project_version_response(
    version: ProjectVersion,
) -> ProjectVersionResponse:
    return ProjectVersionResponse(
        **to_project_version_summary(version).model_dump(),
        document=version.document,
    )


@router.get("", response_model=list[ProjectSummary])
async def list_projects(
    session: DatabaseSession,
    user: CurrentUser,
) -> list[ProjectSummary]:
    member_filters = [ProjectMember.user_id == user.id]

    if user.email is not None:
        member_filters.append(
            func.lower(ProjectMember.email) == user.email,
        )

    result = await session.execute(
        select(Project, ProjectMember.role)
        .outerjoin(
            ProjectMember,
            and_(
                ProjectMember.project_id == Project.id,
                or_(*member_filters),
            ),
        )
        .where(
            Project.deleted_at.is_(None),
            or_(
                Project.owner_id == user.id,
                ProjectMember.id.is_not(None),
            ),
        )
        .order_by(Project.updated_at.desc())
        .limit(100),
    )

    summaries: list[ProjectSummary] = []

    for project, member_role in result:
        if project.owner_id == user.id:
            access_role: ProjectRole = "owner"
        elif project.visibility == "public":
            access_role = project.public_access_role
        elif member_role in ("editor", "viewer"):
            access_role = member_role
        else:
            continue

        summaries.append(to_project_summary(project, access_role))

    return summaries


@router.get("/trash", response_model=list[TrashedProjectSummary])
async def list_trashed_projects(
    session: DatabaseSession,
    user: CurrentUser,
) -> list[TrashedProjectSummary]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=TRASH_RETENTION_DAYS)
    await session.execute(
        delete(Project).where(
            Project.owner_id == user.id,
            Project.deleted_at.is_not(None),
            Project.deleted_at < cutoff,
        )
    )
    await session.commit()

    projects = await session.scalars(
        select(Project)
        .where(
            Project.owner_id == user.id,
            Project.deleted_at.is_not(None),
        )
        .order_by(Project.deleted_at.desc())
        .limit(100)
    )

    return [
        TrashedProjectSummary(
            **to_project_summary(project, "owner").model_dump(),
            deleted_at=project.deleted_at,
            expires_at=project.deleted_at
            + timedelta(days=TRASH_RETENTION_DAYS),
        )
        for project in projects
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: OptionalCurrentUser,
) -> ProjectResponse:
    project, role = await get_readable_project(project_id, session, user)
    return to_project_response(project, role)


@router.get(
    "/{project_id}/versions",
    response_model=list[ProjectVersionSummary],
)
async def list_project_versions(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: OptionalCurrentUser,
) -> list[ProjectVersionSummary]:
    await get_readable_project(project_id, session, user)
    versions = await session.scalars(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == project_id)
        .order_by(ProjectVersion.created_at.desc())
        .limit(100)
    )
    return [to_project_version_summary(version) for version in versions]


@router.post(
    "/{project_id}/versions",
    response_model=ProjectVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_version(
    project_id: uuid.UUID,
    request: ProjectVersionCreate,
    session: DatabaseSession,
    user: CurrentUser,
) -> ProjectVersionResponse:
    project, role = await get_readable_project(project_id, session, user)

    if role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="你只有檢視權限",
        )

    version = ProjectVersion(
        project_id=project.id,
        created_by_id=user.id,
        name=request.name,
        kind="manual",
        document=project.document,
    )
    session.add(version)
    await session.commit()
    await session.refresh(version)
    return to_project_version_response(version)


@router.get(
    "/{project_id}/versions/{version_id}",
    response_model=ProjectVersionResponse,
)
async def get_project_version(
    project_id: uuid.UUID,
    version_id: uuid.UUID,
    session: DatabaseSession,
    user: OptionalCurrentUser,
) -> ProjectVersionResponse:
    await get_readable_project(project_id, session, user)
    version = await get_project_version_or_404(
        project_id,
        version_id,
        session,
    )
    return to_project_version_response(version)


@router.post(
    "/{project_id}/versions/{version_id}/restore",
    response_model=ProjectResponse,
)
async def restore_project_version(
    project_id: uuid.UUID,
    version_id: uuid.UUID,
    request: ProjectVersionRestore,
    session: DatabaseSession,
    user: CurrentUser,
) -> ProjectResponse:
    project, role = await get_readable_project(project_id, session, user)

    if role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="你只有檢視權限",
        )

    version = await get_project_version_or_404(
        project_id,
        version_id,
        session,
    )
    restore_filters = [Project.id == project_id]

    if request.expected_updated_at is not None:
        restore_filters.append(
            Project.updated_at == request.expected_updated_at,
        )

    result = await session.execute(
        update(Project)
        .where(*restore_filters)
        .values(document=version.document, updated_at=func.now())
        .execution_options(synchronize_session=False)
    )

    if result.rowcount != 1:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="專案已在其他分頁或裝置更新",
        )

    session.add(
        ProjectVersion(
            project_id=project.id,
            created_by_id=user.id,
            name="恢復前備份",
            kind="pre_restore",
            document=project.document,
        )
    )
    await session.commit()
    await session.refresh(project)
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

    update_values = {}

    if request.name is not None:
        update_values["name"] = request.name

    if request.document is not None:
        update_values["document"] = request.document.model_dump(by_alias=True)

    if request.visibility is not None:
        update_values["visibility"] = request.visibility

    if request.public_access_role is not None:
        update_values["public_access_role"] = request.public_access_role

    if request.expected_updated_at is not None:
        result = await session.execute(
            update(Project)
            .where(
                Project.id == project_id,
                Project.updated_at == request.expected_updated_at,
            )
            .values(**update_values, updated_at=func.now())
            .execution_options(synchronize_session=False)
        )

        if result.rowcount != 1:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="專案已在其他分頁或裝置更新",
            )
    else:
        for field_name, value in update_values.items():
            setattr(project, field_name, value)

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

    project.deleted_at = datetime.now(timezone.utc)
    await session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/restore", response_model=ProjectResponse)
async def restore_project(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: CurrentUser,
) -> ProjectResponse:
    project = await session.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user.id,
            Project.deleted_at.is_not(None),
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="垃圾桶中找不到此專案",
        )

    if project.deleted_at < datetime.now(timezone.utc) - timedelta(
        days=TRASH_RETENTION_DAYS
    ):
        await session.delete(project)
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="此專案已超過 30 天保留期限",
        )

    project.deleted_at = None
    await session.commit()
    await session.refresh(project)
    return to_project_response(project, "owner")


@router.delete(
    "/{project_id}/permanent",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def permanently_delete_project(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: CurrentUser,
) -> Response:
    project = await session.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == user.id,
            Project.deleted_at.is_not(None),
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="垃圾桶中找不到此專案",
        )

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


@router.get(
    "/{project_id}/members",
    response_model=list[ProjectMemberResponse],
)
async def list_project_members(
    project_id: uuid.UUID,
    session: DatabaseSession,
    user: CurrentUser,
) -> list[ProjectMember]:
    await get_project_or_404(project_id, session, user.id)
    result = await session.scalars(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.created_at.asc()),
    )

    return list(result)


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_project_member(
    project_id: uuid.UUID,
    request: ProjectMemberCreate,
    session: DatabaseSession,
    user: CurrentUser,
) -> ProjectMember:
    await get_project_or_404(project_id, session, user.id)

    if user.email is not None and request.email == user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="你已經是此專案的擁有者",
        )

    existing_member = await session.scalar(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            func.lower(ProjectMember.email) == request.email,
        ),
    )

    if existing_member is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="此 Email 已經在成員名單中",
        )

    member = ProjectMember(
        project_id=project_id,
        email=request.email,
        role=request.role,
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)

    return member


@router.patch(
    "/{project_id}/members/{member_id}",
    response_model=ProjectMemberResponse,
)
async def update_project_member(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    request: ProjectMemberUpdate,
    session: DatabaseSession,
    user: CurrentUser,
) -> ProjectMember:
    await get_project_or_404(project_id, session, user.id)
    member = await get_project_member_or_404(
        project_id,
        member_id,
        session,
    )
    member.role = request.role
    await session.commit()
    await session.refresh(member)

    return member


@router.delete(
    "/{project_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_project_member(
    project_id: uuid.UUID,
    member_id: uuid.UUID,
    session: DatabaseSession,
    user: CurrentUser,
) -> Response:
    await get_project_or_404(project_id, session, user.id)
    member = await get_project_member_or_404(
        project_id,
        member_id,
        session,
    )
    await session.delete(member)
    await session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
