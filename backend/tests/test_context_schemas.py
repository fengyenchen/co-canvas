import pytest
from pydantic import ValidationError

from app.schemas import ContextNode


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
                "durationMs": 60_000,
            },
        }
    )

    assert context.start_time_ms == 10_000
    assert context.linked_video is not None
    assert context.linked_video.provider == "YouTube"


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
