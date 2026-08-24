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
    duration_ms: int | None = Field(default=None, ge=0)


class ContextNode(ApiModel):
    id: str
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(default="", max_length=2000)
    node_type: Literal["concept", "video"] = "concept"
    start_time_ms: int | None = Field(default=None, ge=0)
    end_time_ms: int | None = Field(default=None, ge=0)
    video_provider: str | None = Field(default=None, max_length=40)
    video_duration_ms: int | None = Field(default=None, ge=0)
    linked_video: LinkedVideoContext | None = None

    @model_validator(mode="after")
    def validate_time_range(self):
        has_start = self.start_time_ms is not None
        has_end = self.end_time_ms is not None

        if has_start != has_end:
            raise ValueError("startTimeMs and endTimeMs must be set together")
        if has_start and self.end_time_ms <= self.start_time_ms:
            raise ValueError("endTimeMs must be greater than startTimeMs")
        return self


class GenerateSuggestionRequest(ApiModel):
    prompt: str = Field(min_length=1, max_length=2000)
    selected_node: ContextNode | None = None
    neighbor_nodes: list[ContextNode] = Field(default_factory=list, max_length=20)


class ChatHistoryMessage(ApiModel):
    role: Literal["user", "ai"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(ApiModel):
    prompt: str = Field(min_length=1, max_length=4000)
    selected_node: ContextNode | None = None
    neighbor_nodes: list[ContextNode] = Field(default_factory=list, max_length=20)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=30)


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


class AnalyzeVideoRequest(ApiModel):
    video_node_id: str = Field(min_length=1)
    provider: Literal["youtube"]
    source: str = Field(min_length=1, max_length=2048)
    title: str = Field(min_length=1, max_length=120)
    prompt: str = Field(min_length=1, max_length=2000)
    max_segments: int = Field(default=5, ge=2, le=8)

    @model_validator(mode="after")
    def validate_youtube_source(self):
        source = self.source.lower()
        if "youtube.com/" not in source and "youtu.be/" not in source:
            raise ValueError("第一版影片分析僅支援 YouTube 網址")
        return self
