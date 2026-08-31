from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class LinkedVideoContext(ApiModel):
    id: str
    title: str = Field(min_length=1, max_length=120)
    provider: str = Field(min_length=1, max_length=40)
    source: str | None = Field(default=None, max_length=2048)
    duration_ms: int | None = Field(default=None, ge=0)


class LinkedFileContext(ApiModel):
    id: str
    title: str = Field(min_length=1, max_length=120)
    node_type: Literal["document", "image", "audio"]
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=160)
    file_size: int | None = Field(default=None, ge=0, le=100 * 1024 * 1024)
    file_source: str | None = Field(default=None, max_length=2048)
    page_count: int | None = Field(default=None, ge=1, le=100000)
    page_unit: Literal["page", "slide"] | None = None
    duration_ms: int | None = Field(default=None, gt=0)


class ContextNode(ApiModel):
    id: str
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(default="", max_length=2000)
    node_type: Literal["concept", "video", "audio", "document", "image", "group"] = "concept"
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=160)
    file_size: int | None = Field(default=None, ge=0, le=100 * 1024 * 1024)
    file_source: str | None = Field(default=None, max_length=2048)
    start_time_ms: int | None = Field(default=None, ge=0)
    end_time_ms: int | None = Field(default=None, ge=0)
    video_provider: str | None = Field(default=None, max_length=40)
    video_duration_ms: int | None = Field(default=None, ge=0)
    audio_duration_ms: int | None = Field(default=None, ge=0)
    linked_video: LinkedVideoContext | None = None
    linked_file: LinkedFileContext | None = None
    document_start_page: int | None = Field(default=None, ge=1)
    document_end_page: int | None = Field(default=None, ge=1)
    group_members: list["ContextNode"] = Field(default_factory=list, max_length=500)
    group_relations: list["GroupContextRelation"] = Field(
        default_factory=list,
        max_length=1000,
    )

    @model_validator(mode="after")
    def validate_time_range(self):
        has_start = self.start_time_ms is not None
        has_end = self.end_time_ms is not None

        if has_start != has_end:
            raise ValueError("startTimeMs and endTimeMs must be set together")
        if has_start and self.end_time_ms <= self.start_time_ms:
            raise ValueError("endTimeMs must be greater than startTimeMs")
        has_start_page = self.document_start_page is not None
        has_end_page = self.document_end_page is not None
        if has_start_page != has_end_page:
            raise ValueError("documentStartPage and documentEndPage must be set together")
        if (
            self.document_start_page is not None
            and self.document_end_page is not None
            and self.document_end_page < self.document_start_page
        ):
            raise ValueError("documentEndPage must not be less than documentStartPage")
        if (
            self.document_end_page is not None
            and self.linked_file
            and self.linked_file.page_count
            and self.document_end_page > self.linked_file.page_count
        ):
            raise ValueError("documentEndPage exceeds pageCount")
        return self


class GroupContextRelation(ApiModel):
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    label: str | None = Field(default=None, max_length=80)


ContextNode.model_rebuild()


class GenerateSuggestionRequest(ApiModel):
    prompt: str = Field(min_length=1, max_length=2000)
    selected_node: ContextNode | None = None
    neighbor_nodes: list[ContextNode] = Field(default_factory=list, max_length=20)


class ChatHistoryMessage(ApiModel):
    role: Literal["user", "ai"]
    content: str = Field(min_length=1, max_length=4000)


class UploadedVideoFile(ApiModel):
    name: str = Field(pattern=r"^files/[A-Za-z0-9_-]+$", max_length=160)


class UploadedFile(ApiModel):
    name: str = Field(pattern=r"^files/[A-Za-z0-9_-]+$", max_length=160)


class ChatRequest(ApiModel):
    prompt: str = Field(min_length=1, max_length=4000)
    selected_node: ContextNode | None = None
    neighbor_nodes: list[ContextNode] = Field(default_factory=list, max_length=20)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=30)
    uploaded_video: UploadedVideoFile | None = None
    uploaded_file: UploadedFile | None = None


class VideoUploadStartRequest(ApiModel):
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: Literal["video/mp4", "video/mov", "video/webm"]
    size: int = Field(gt=0, le=450 * 1024 * 1024)


SUPPORTED_FILE_MIME_TYPES = {
    "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "image/bmp",
    "application/pdf", "application/json",
    "text/plain", "text/markdown", "text/csv", "text/html", "text/css", "text/xml",
    "text/rtf", "text/javascript",
    "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac",
    "audio/ogg", "audio/flac", "audio/x-flac",
}


class FileUploadStartRequest(ApiModel):
    file_name: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=1, max_length=160)
    size: int = Field(gt=0, le=100 * 1024 * 1024)

    @model_validator(mode="after")
    def validate_mime_type(self):
        if self.mime_type not in SUPPORTED_FILE_MIME_TYPES:
            raise ValueError("不支援的檔案格式")
        if self.mime_type == "application/pdf" and self.size > 50 * 1024 * 1024:
            raise ValueError("PDF 超過 50 MB 限制")
        return self


class VideoUploadStartResponse(ApiModel):
    upload_url: str = Field(min_length=1)
    chunk_size: int = Field(gt=0, le=8 * 1024 * 1024)


class VideoUploadChunkResponse(ApiModel):
    file_name: str | None = Field(
        default=None,
        pattern=r"^files/[A-Za-z0-9_-]+$",
        max_length=160,
    )


class ChatResponse(ApiModel):
    message: str = Field(min_length=1)


AiMode = Literal["gemini", "mock"]
AiFallbackReason = Literal[
    "configured_mock",
    "unauthenticated",
    "missing_key",
    "invalid_key",
    "quota_exceeded",
]


class ChatApiResponse(ChatResponse):
    ai_mode: AiMode
    fallback_reason: AiFallbackReason | None = None


class SuggestedNode(ApiModel):
    temp_id: str
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(default="", max_length=2000)


class SuggestedRelation(ApiModel):
    source_temp_id: str
    target_temp_id: str
    label: str | None = Field(default=None, max_length=80)


class GenerateSuggestionResponse(ApiModel):
    nodes: list[SuggestedNode] = Field(min_length=1, max_length=8)
    relations: list[SuggestedRelation] = Field(default_factory=list, max_length=20)


class GenerateSuggestionApiResponse(GenerateSuggestionResponse):
    ai_mode: AiMode
    fallback_reason: AiFallbackReason | None = None
