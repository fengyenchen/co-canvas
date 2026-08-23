import pytest
from pydantic import ValidationError

from app.project_schemas import ProjectDocument, ProjectVideoNode


def create_video_node(duration_ms: int | None = 60_000) -> dict[str, object]:
    data: dict[str, object] = {
        "title": "研究影片",
        "content": "",
        "origin": "user",
        "sourceType": "url",
        "source": "https://example.com/video.mp4",
    }
    if duration_ms is not None:
        data["durationMs"] = duration_ms

    return {
        "id": "video-1",
        "type": "video",
        "position": {"x": 0, "y": 0},
        "data": data,
    }


def create_concept_node(data: dict[str, object]) -> dict[str, object]:
    return {
        "id": "node-1",
        "type": "concept",
        "position": {"x": 0, "y": 200},
        "data": {
            "title": "研究目標",
            "content": "釐清研究問題",
            "origin": "user",
            **data,
        },
    }


def test_upgrades_version_one_document() -> None:
    document = ProjectDocument.model_validate(
        {"version": 1, "nodes": [], "edges": [], "messages": []}
    )

    assert document.version == 3
    assert document.nodes == []


def test_accepts_video_node_before_source_is_configured() -> None:
    video_node = create_video_node()
    video_node["data"] = {**video_node["data"], "source": ""}

    document = ProjectDocument.model_validate(
        {"version": 3, "nodes": [video_node], "edges": [], "messages": []}
    )

    assert isinstance(document.nodes[0], ProjectVideoNode)
    assert document.nodes[0].data.source == ""


def test_upgrades_version_two_media_to_video_node() -> None:
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
                create_concept_node(
                    {"startTimeMs": 1_000, "endTimeMs": 5_000}
                )
            ],
            "edges": [],
            "messages": [],
        }
    )

    assert document.version == 3
    assert len(document.nodes) == 2
    assert document.nodes[0].data.media_node_id == "legacy-video"
    assert isinstance(document.nodes[1], ProjectVideoNode)


def test_accepts_multiple_video_nodes_and_segment_binding() -> None:
    document = ProjectDocument.model_validate(
        {
            "version": 3,
            "nodes": [
                create_video_node(),
                {
                    **create_video_node(),
                    "id": "video-2",
                    "data": {
                        **create_video_node()["data"],
                        "source": "https://example.com/second.mp4",
                    },
                },
                create_concept_node(
                    {
                        "mediaNodeId": "video-2",
                        "startTimeMs": 1_000,
                        "endTimeMs": 5_000,
                    }
                ),
            ],
            "edges": [],
            "messages": [],
        }
    )

    assert document.nodes[2].data.media_node_id == "video-2"


@pytest.mark.parametrize(
    ("node_data", "error_message"),
    [
        ({"mediaNodeId": "video-1", "startTimeMs": 1_000}, "開始與結束時間必須同時設定"),
        (
            {"mediaNodeId": "video-1", "startTimeMs": 5_000, "endTimeMs": 5_000},
            "結束時間必須晚於開始時間",
        ),
        (
            {"mediaNodeId": "missing", "startTimeMs": 1_000, "endTimeMs": 2_000},
            "節點引用了不存在的影片節點",
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
                "version": 3,
                "nodes": [create_video_node(), create_concept_node(node_data)],
                "edges": [],
                "messages": [],
            }
        )


def test_rejects_segment_past_bound_video_duration() -> None:
    with pytest.raises(ValidationError, match="節點時間不得超出影片長度"):
        ProjectDocument.model_validate(
            {
                "version": 3,
                "nodes": [
                    create_video_node(10_000),
                    create_concept_node(
                        {
                            "mediaNodeId": "video-1",
                            "startTimeMs": 9_000,
                            "endTimeMs": 11_000,
                        }
                    ),
                ],
                "edges": [],
                "messages": [],
            }
        )
