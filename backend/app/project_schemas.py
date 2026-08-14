import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas import ApiModel


ProjectVisibility = Literal["private", "public"]
ProjectRole = Literal["owner", "editor", "viewer"]
PublicAccessRole = Literal["editor", "viewer"]


class ProjectPosition(ApiModel):
    x: float
    y: float


class ProjectNodeData(ApiModel):
    title: str = Field(max_length=120)
    content: str = Field(default="", max_length=2000)
    origin: Literal["user", "ai"]


class ProjectNode(ApiModel):
    id: str = Field(min_length=1)
    type: Literal["concept"] = "concept"
    position: ProjectPosition
    data: ProjectNodeData


class ProjectEdgeData(ApiModel):
    label: str | None = Field(default=None, max_length=80)
    origin: Literal["user", "ai"]


class ProjectEdge(ApiModel):
    id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    label: str | None = Field(default=None, max_length=80)
    data: ProjectEdgeData | None = None


class ProjectMessage(ApiModel):
    id: str = Field(min_length=1)
    role: Literal["user", "ai"]
    content: str = Field(max_length=4000)
    context_node_id: str | None = None
    created_at: str
    can_generate_nodes: bool | None = None
    latency_ms: float | None = Field(default=None, ge=0)
    is_error: bool | None = None
    retry_action: Literal["chat", "suggestion"] | None = None
    retry_content: str | None = Field(default=None, max_length=4000)


class ProjectDocument(ApiModel):
    version: Literal[1] = 1
    nodes: list[ProjectNode] = Field(default_factory=list, max_length=500)
    edges: list[ProjectEdge] = Field(default_factory=list, max_length=1000)
    messages: list[ProjectMessage] = Field(
        default_factory=list,
        max_length=2000,
    )


class ProjectCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    document: ProjectDocument = Field(default_factory=ProjectDocument)
    visibility: ProjectVisibility = "private"
    public_access_role: PublicAccessRole = "viewer"

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = value.strip()

        if not name:
            raise ValueError("專案名稱不可為空白")

        return name


class ProjectUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    document: ProjectDocument | None = None
    visibility: ProjectVisibility | None = None
    public_access_role: PublicAccessRole | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        name = value.strip()

        if not name:
            raise ValueError("專案名稱不可為空白")

        return name

    @model_validator(mode="after")
    def require_change(self) -> "ProjectUpdate":
        if (
            self.name is None
            and self.document is None
            and self.visibility is None
            and self.public_access_role is None
        ):
            raise ValueError("至少需要提供一個要更新的欄位")

        return self


class ProjectSummary(ApiModel):
    id: uuid.UUID
    name: str
    visibility: ProjectVisibility
    public_access_role: PublicAccessRole
    created_at: datetime
    updated_at: datetime


class ProjectResponse(ProjectSummary):
    document: ProjectDocument
