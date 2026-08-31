import uuid
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator

from app.schemas import ApiModel


ProjectVisibility = Literal["private", "public"]
ProjectRole = Literal["owner", "editor", "viewer"]
PublicAccessRole = Literal["editor", "viewer"]
ProjectMemberRole = Literal["editor", "viewer"]
ProjectVersionKind = Literal["manual", "automatic", "pre_restore", "pre_import"]


class ProjectPosition(ApiModel):
    x: float
    y: float


class ProjectConceptNodeData(ApiModel):
    title: str = Field(max_length=120)
    content: str = Field(default="", max_length=2000)
    origin: Literal["user", "ai"]
    color: Literal[
        "default",
        "yellow",
        "pink",
        "blue",
        "green",
        "purple",
    ] = "default"
    start_time_ms: int | None = Field(default=None, ge=0)
    end_time_ms: int | None = Field(default=None, ge=0)
    document_start_page: int | None = Field(default=None, ge=1)
    document_end_page: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_time_range(self) -> "ProjectConceptNodeData":
        has_start_time = self.start_time_ms is not None
        has_end_time = self.end_time_ms is not None

        if has_start_time != has_end_time:
            raise ValueError("開始與結束時間必須同時設定")

        if (
            self.start_time_ms is not None
            and self.end_time_ms is not None
            and self.end_time_ms <= self.start_time_ms
        ):
            raise ValueError("結束時間必須晚於開始時間")

        has_start_page = self.document_start_page is not None
        has_end_page = self.document_end_page is not None
        if has_start_page != has_end_page:
            raise ValueError("文件開始與結束頁必須同時設定")
        if (
            self.document_start_page is not None
            and self.document_end_page is not None
            and self.document_end_page < self.document_start_page
        ):
            raise ValueError("文件結束頁不得早於開始頁")

        return self


class ProjectVideoNodeData(ApiModel):
    title: str = Field(max_length=120)
    content: str = Field(default="", max_length=2000)
    origin: Literal["user", "ai"]
    source_type: Literal["url"] = "url"
    source: str = Field(default="", max_length=2048)
    duration_ms: int | None = Field(default=None, gt=0)

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        if not value:
            return value

        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("影片網址必須為空白或使用 http、https")

        return value


class ProjectDocumentNodeData(ApiModel):
    title: str = Field(max_length=120)
    content: str = Field(default="", max_length=2000)
    origin: Literal["user", "ai"]
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=160)
    size: int | None = Field(default=None, ge=0, le=100 * 1024 * 1024)
    source: str | None = Field(default=None, max_length=2048)
    page_count: int | None = Field(default=None, ge=1, le=100000)
    page_unit: Literal["page", "slide"] | None = None


class ProjectAudioNodeData(ProjectDocumentNodeData):
    duration_ms: int | None = Field(default=None, gt=0)


class ProjectGroupNodeData(ApiModel):
    title: str = Field(default="未命名群組", max_length=120)
    width: float = Field(ge=240, le=10000)
    height: float = Field(ge=160, le=10000)
    color: Literal["default", "yellow", "pink", "blue", "green", "purple"] = "default"
    collapsed: bool = False
    locked: bool = False


class ProjectConceptNode(ApiModel):
    id: str = Field(min_length=1)
    type: Literal["concept"] = "concept"
    position: ProjectPosition
    data: ProjectConceptNodeData
    parent_id: str | None = None


class ProjectVideoNode(ApiModel):
    id: str = Field(min_length=1)
    type: Literal["video"] = "video"
    position: ProjectPosition
    data: ProjectVideoNodeData
    parent_id: str | None = None


class ProjectDocumentNode(ApiModel):
    id: str = Field(min_length=1)
    type: Literal["document"] = "document"
    position: ProjectPosition
    data: ProjectDocumentNodeData
    parent_id: str | None = None


class ProjectGroupNode(ApiModel):
    id: str = Field(min_length=1)
    type: Literal["group"] = "group"
    position: ProjectPosition
    data: ProjectGroupNodeData


class ProjectImageNode(ApiModel):
    id: str = Field(min_length=1)
    type: Literal["image"] = "image"
    position: ProjectPosition
    data: ProjectDocumentNodeData
    parent_id: str | None = None


class ProjectAudioNode(ApiModel):
    id: str = Field(min_length=1)
    type: Literal["audio"] = "audio"
    position: ProjectPosition
    data: ProjectAudioNodeData
    parent_id: str | None = None


ProjectNode = ProjectConceptNode | ProjectVideoNode | ProjectDocumentNode | ProjectImageNode | ProjectAudioNode | ProjectGroupNode


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
    author_id: str | None = Field(default=None, max_length=255)
    author_email: str | None = Field(default=None, max_length=320)
    author_name: str | None = Field(default=None, max_length=120)
    can_generate_nodes: bool | None = None
    latency_ms: float | None = Field(default=None, ge=0)
    is_error: bool | None = None
    retry_action: Literal["chat", "suggestion"] | None = None
    retry_content: str | None = Field(default=None, max_length=4000)


class ProjectSuggestionDecisionEvent(ApiModel):
    id: str = Field(min_length=1)
    action: Literal["accepted", "rejected", "regenerated"]
    context_node_id: str | None = None
    ai_mode: Literal["gemini", "mock"]
    edited: bool
    decision_time_ms: int = Field(ge=0)
    node_count: int = Field(ge=0, le=8)
    created_at: datetime


class ProjectResearchEventsSync(ApiModel):
    events: list[ProjectSuggestionDecisionEvent] = Field(
        min_length=1,
        max_length=5000,
    )


class ProjectDocument(ApiModel):
    version: Literal[4] = 4
    nodes: list[ProjectNode] = Field(default_factory=list, max_length=500)
    edges: list[ProjectEdge] = Field(default_factory=list, max_length=1000)
    messages: list[ProjectMessage] = Field(
        default_factory=list,
        max_length=2000,
    )
    suggestion_events: list[ProjectSuggestionDecisionEvent] = Field(
        default_factory=list,
        max_length=5000,
    )

    @model_validator(mode="before")
    @classmethod
    def upgrade_legacy_document(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value

        raw_nodes = value.get("nodes", [])
        if isinstance(raw_nodes, list):
            value = {
                **value,
                "nodes": [
                    {**node, "type": "document"}
                    if isinstance(node, dict) and node.get("type") == "file"
                    else node
                    for node in raw_nodes
                ],
            }

        if value.get("version") == 1:
            return {**value, "version": 4}

        if value.get("version") == 3:
            nodes = list(value.get("nodes", []))
            edges = list(value.get("edges", []))
            edge_ids = {
                edge.get("id")
                for edge in edges
                if isinstance(edge, dict) and isinstance(edge.get("id"), str)
            }
            migrated_nodes: list[object] = []

            for node in nodes:
                if not isinstance(node, dict) or node.get("type") != "concept":
                    migrated_nodes.append(node)
                    continue
                data = node.get("data")
                if not isinstance(data, dict):
                    migrated_nodes.append(node)
                    continue

                media_node_id = data.get("mediaNodeId", data.get("media_node_id"))
                next_data = {
                    key: item
                    for key, item in data.items()
                    if key not in {"mediaNodeId", "media_node_id"}
                }
                if isinstance(media_node_id, str):
                    already_linked = any(
                        isinstance(edge, dict)
                        and edge.get("source") == media_node_id
                        and edge.get("target") == node.get("id")
                        for edge in edges
                    )
                    if not already_linked:
                        edge_id = f"migrated-video-link-{node.get('id')}"
                        suffix = 1
                        while edge_id in edge_ids:
                            suffix += 1
                            edge_id = f"migrated-video-link-{node.get('id')}-{suffix}"
                        edge_ids.add(edge_id)
                        edges.append(
                            {
                                "id": edge_id,
                                "source": media_node_id,
                                "target": node.get("id"),
                                "data": {"origin": "user"},
                            }
                        )
                migrated_nodes.append({**node, "data": next_data})

            return {**value, "version": 4, "nodes": migrated_nodes, "edges": edges}

        if value.get("version") != 2:
            return value

        nodes = list(value.get("nodes", []))
        media = value.get("media")

        if not isinstance(media, dict):
            document = {key: item for key, item in value.items() if key != "media"}
            return {**document, "version": 4}

        node_ids = {
            node.get("id")
            for node in nodes
            if isinstance(node, dict) and isinstance(node.get("id"), str)
        }
        video_node_id = "legacy-video"
        suffix = 1
        while video_node_id in node_ids:
            suffix += 1
            video_node_id = f"legacy-video-{suffix}"

        y_positions = [
            node["position"]["y"]
            for node in nodes
            if isinstance(node, dict)
            and isinstance(node.get("position"), dict)
            and isinstance(node["position"].get("y"), (int, float))
        ]
        migrated_edges = list(value.get("edges", []))
        for node in nodes:
            if not isinstance(node, dict) or node.get("type") != "concept":
                continue

            data = node.get("data")
            if not isinstance(data, dict):
                continue

            has_time = (
                "startTimeMs" in data
                or "endTimeMs" in data
                or "start_time_ms" in data
                or "end_time_ms" in data
            )
            if has_time and isinstance(node.get("id"), str):
                migrated_edges.append(
                    {
                        "id": f"migrated-video-link-{node['id']}",
                        "source": video_node_id,
                        "target": node["id"],
                        "data": {"origin": "user"},
                    }
                )

        title = media.get("title")
        duration_ms = media.get("durationMs", media.get("duration_ms"))
        video_data = {
            "title": title if isinstance(title, str) and title else "影片",
            "content": "",
            "origin": "user",
            "sourceType": media.get("sourceType", media.get("source_type", "url")),
            "source": media.get("source"),
        }
        if duration_ms is not None:
            video_data["durationMs"] = duration_ms

        document = {key: item for key, item in value.items() if key != "media"}
        return {
            **document,
            "version": 4,
            "nodes": [
                *nodes,
                {
                    "id": video_node_id,
                    "type": "video",
                    "position": {
                        "x": 0,
                        "y": min(y_positions, default=100) - 220,
                    },
                    "data": video_data,
                },
            ],
            "edges": migrated_edges,
        }

    @model_validator(mode="after")
    def validate_node_time_ranges(self) -> "ProjectDocument":
        group_ids = {
            node.id
            for node in self.nodes
            if isinstance(node, ProjectGroupNode)
        }
        media_nodes = {
            node.id: node
            for node in self.nodes
            if isinstance(node, (ProjectVideoNode, ProjectAudioNode))
        }
        document_nodes = {
            node.id: node
            for node in self.nodes
            if isinstance(node, ProjectDocumentNode)
        }

        for node in self.nodes:
            if (
                isinstance(node, (ProjectConceptNode, ProjectVideoNode, ProjectDocumentNode, ProjectImageNode, ProjectAudioNode))
                and node.parent_id is not None
                and node.parent_id not in group_ids
            ):
                raise ValueError("群組成員引用了不存在的群組")

            if not isinstance(node, ProjectConceptNode):
                continue

            start_time_ms = node.data.start_time_ms
            end_time_ms = node.data.end_time_ms
            start_page = node.data.document_start_page
            end_page = node.data.document_end_page

            if start_page is not None and end_page is not None:
                linked_document_ids = list(dict.fromkeys(
                    edge.source
                    for edge in self.edges
                    if edge.target == node.id and edge.source in document_nodes
                ))
                if not linked_document_ids:
                    raise ValueError("設定頁面範圍前必須先連接文件節點")
                if len(linked_document_ids) > 1:
                    raise ValueError("設定頁面範圍的文字節點只能連接一個文件節點")
                page_count = document_nodes[linked_document_ids[0]].data.page_count
                if page_count is not None and end_page > page_count:
                    raise ValueError("文件結束頁不得超出文件頁數")

            if start_time_ms is None or end_time_ms is None:
                continue

            linked_media_ids = list(dict.fromkeys(
                edge.source
                for edge in self.edges
                if edge.target == node.id and edge.source in media_nodes
            ))
            if not linked_media_ids:
                raise ValueError("設定節點時間前必須先連接影片或音訊節點")
            if len(linked_media_ids) > 1:
                raise ValueError("設定時間區間的文字節點只能連接一個影音來源")

            media_node = media_nodes[linked_media_ids[0]]

            if (
                media_node.data.duration_ms is not None
                and end_time_ms > media_node.data.duration_ms
            ):
                raise ValueError("節點時間不得超出影音長度")

        return self


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
    expected_updated_at: datetime | None = None

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
    access_role: ProjectRole
    created_at: datetime
    updated_at: datetime
    last_viewed_at: datetime | None = None


class ProjectResponse(ProjectSummary):
    document: ProjectDocument


class TrashedProjectSummary(ProjectSummary):
    deleted_at: datetime
    expires_at: datetime


class ProjectVersionCreate(ApiModel):
    name: str | None = Field(default=None, max_length=120)
    kind: Literal["manual", "automatic", "pre_import"] = "manual"

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        name = value.strip()
        return name or None


class ProjectVersionRestore(ApiModel):
    expected_updated_at: datetime | None = None


class ProjectVersionSummary(ApiModel):
    id: uuid.UUID
    name: str | None
    kind: ProjectVersionKind
    created_at: datetime


class ProjectVersionResponse(ProjectVersionSummary):
    document: ProjectDocument


class ProjectMemberCreate(ApiModel):
    email: str = Field(
        min_length=3,
        max_length=320,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    role: ProjectMemberRole

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()

        return value


class ProjectMemberUpdate(ApiModel):
    role: ProjectMemberRole


class ProjectMemberResponse(ApiModel):
    id: uuid.UUID
    email: str
    role: ProjectMemberRole
    created_at: datetime
