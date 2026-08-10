from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ContextNode(ApiModel):
    id: str
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(default="", max_length=2000)


class GenerateSuggestionRequest(ApiModel):
    prompt: str = Field(min_length=1, max_length=2000)
    selected_node: ContextNode | None = None
    neighbor_nodes: list[ContextNode] = Field(default_factory=list, max_length=20)


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
