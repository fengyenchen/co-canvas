import pytest
from pydantic import ValidationError

from app.project_schemas import ProjectDocument


def create_node(data: dict[str, object]) -> dict[str, object]:
    return {
        "id": "node-1",
        "type": "concept",
        "position": {"x": 0, "y": 0},
        "data": {
            "title": "研究目標",
            "content": "釐清研究問題",
            "origin": "user",
            **data,
        },
    }


def test_upgrades_version_one_document() -> None:
    document = ProjectDocument.model_validate(
        {
            "version": 1,
            "nodes": [],
            "edges": [],
            "messages": [],
        }
    )

    assert document.version == 2
    assert document.media is None


def test_accepts_video_segment() -> None:
    document = ProjectDocument.model_validate(
        {
            "version": 2,
            "media": {
                "type": "video",
                "sourceType": "url",
                "source": "https://example.com/video.mp4",
                "durationMs": 60_000,
            },
            "nodes": [
                create_node(
                    {
                        "startTimeMs": 1_000,
                        "endTimeMs": 5_000,
                    }
                )
            ],
            "edges": [],
            "messages": [],
        }
    )

    assert document.nodes[0].data.start_time_ms == 1_000
    assert document.nodes[0].data.end_time_ms == 5_000


@pytest.mark.parametrize(
    ("node_data", "error_message"),
    [
        (
            {"startTimeMs": 1_000},
            "開始與結束時間必須同時設定",
        ),
        (
            {"startTimeMs": 5_000, "endTimeMs": 5_000},
            "結束時間必須晚於開始時間",
        ),
    ],
)
def test_rejects_invalid_video_segment(
    node_data: dict[str, object],
    error_message: str,
) -> None:
    with pytest.raises(ValidationError, match=error_message):
        ProjectDocument.model_validate(
            {
                "version": 2,
                "media": {
                    "type": "video",
                    "sourceType": "url",
                    "source": "https://example.com/video.mp4",
                },
                "nodes": [create_node(node_data)],
                "edges": [],
                "messages": [],
            }
        )


def test_rejects_segment_past_video_duration() -> None:
    with pytest.raises(ValidationError, match="節點時間不得超出影片長度"):
        ProjectDocument.model_validate(
            {
                "version": 2,
                "media": {
                    "type": "video",
                    "sourceType": "url",
                    "source": "https://example.com/video.mp4",
                    "durationMs": 10_000,
                },
                "nodes": [
                    create_node(
                        {
                            "startTimeMs": 9_000,
                            "endTimeMs": 11_000,
                        }
                    )
                ],
                "edges": [],
                "messages": [],
            }
        )
