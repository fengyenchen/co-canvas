import pytest
from pydantic import ValidationError

from app.schemas import ChatRequest, ContextNode
from app.services.gemini import build_chat_parts


def test_accepts_video_aware_context() -> None:
    context = ContextNode.model_validate(
        {
            "id": "concept-1",
            "title": "關鍵發現",
            "content": "人工整理的片段重點",
            "nodeType": "concept",
            "startTimeMs": 10_000,
            "endTimeMs": 20_000,
            "linkedVideo": {
                "id": "video-1",
                "title": "研究影片",
                "provider": "YouTube",
                "source": "https://www.youtube.com/watch?v=9hE5-98ZeCg",
                "durationMs": 60_000,
            },
        }
    )

    assert context.start_time_ms == 10_000
    assert context.linked_video is not None
    assert context.linked_video.provider == "YouTube"
    assert context.linked_video.source == "https://www.youtube.com/watch?v=9hE5-98ZeCg"


@pytest.mark.parametrize(
    "payload",
    [
        {"startTimeMs": 1_000},
        {"startTimeMs": 2_000, "endTimeMs": 1_000},
    ],
)
def test_rejects_invalid_context_time_range(payload: dict[str, int]) -> None:
    with pytest.raises(ValidationError):
        ContextNode.model_validate(
            {
                "id": "concept-1",
                "title": "片段",
                **payload,
            }
        )


def test_chat_attaches_selected_youtube_clip() -> None:
    request = ChatRequest.model_validate(
        {
            "prompt": "這個片段在說什麼？",
            "selectedNode": {
                "id": "concept-1",
                "title": "關鍵片段",
                "startTimeMs": 10_000,
                "endTimeMs": 20_000,
                "linkedVideo": {
                    "id": "video-1",
                    "title": "研究影片",
                    "provider": "YouTube",
                    "source": "https://youtu.be/9hE5-98ZeCg",
                },
            },
        }
    )

    parts = build_chat_parts(request, "（尚無先前對話）")

    assert len(parts) == 2
    assert parts[0].file_data.file_uri == "https://youtu.be/9hE5-98ZeCg"
    assert parts[0].video_metadata.start_offset == "10.0s"
    assert parts[0].video_metadata.end_offset == "20.0s"
    assert "這個片段在說什麼？" in parts[1].text


def test_accepts_group_context_with_members_and_relations() -> None:
    context = ContextNode.model_validate(
        {
            "id": "group-1",
            "title": "研究發現",
            "nodeType": "group",
            "groupMembers": [
                {
                    "id": "concept-1",
                    "title": "關鍵發現",
                    "content": "使用者需要保留控制權",
                    "nodeType": "concept",
                }
            ],
            "groupRelations": [
                {
                    "source": "concept-1",
                    "target": "external-1",
                    "label": "支持",
                }
            ],
        }
    )

    assert context.node_type == "group"
    assert context.group_members[0].title == "關鍵發現"
    assert context.group_relations[0].label == "支持"
