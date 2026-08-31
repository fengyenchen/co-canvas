import pytest
from pydantic import ValidationError

from app.project_schemas import (
    ProjectAudioNode,
    ProjectDocument,
    ProjectUpdate,
    ProjectVersionCreate,
    ProjectVersionResponse,
    ProjectVersionRestore,
    ProjectGroupNode,
    ProjectVideoNode,
    ProjectDocumentNode,
    ProjectImageNode,
)


def test_accepts_document_and_image_nodes() -> None:
    document = ProjectDocument.model_validate({
        "version": 4,
        "nodes": [
            {"id": "document-1", "type": "document", "position": {"x": 0, "y": 0}, "data": {"title": "報告", "content": "", "origin": "user", "fileName": "report.pdf", "mimeType": "application/pdf", "size": 1024}},
            {"id": "image-1", "type": "image", "position": {"x": 100, "y": 0}, "data": {"title": "圖片", "content": "", "origin": "user", "source": "https://example.com/image.png"}},
        ],
        "edges": [], "messages": [],
    })
    assert isinstance(document.nodes[0], ProjectDocumentNode)
    assert isinstance(document.nodes[1], ProjectImageNode)


def test_accepts_document_page_range_connected_to_document() -> None:
    document = ProjectDocument.model_validate({
        "version": 4,
        "nodes": [
            {
                "id": "document-1", "type": "document", "position": {"x": 0, "y": 0},
                "data": {
                    "title": "報告", "content": "", "origin": "user",
                    "fileName": "report.pdf", "mimeType": "application/pdf",
                    "pageCount": 12, "pageUnit": "page",
                },
            },
            create_concept_node({"documentStartPage": 1, "documentEndPage": 10}),
        ],
        "edges": [{"id": "edge-1", "source": "document-1", "target": "node-1", "data": {"origin": "user"}}],
        "messages": [],
    })
    assert document.nodes[1].data.document_end_page == 10


def test_rejects_document_page_range_past_page_count() -> None:
    with pytest.raises(ValidationError):
        ProjectDocument.model_validate({
            "version": 4,
            "nodes": [
                {
                    "id": "document-1", "type": "document", "position": {"x": 0, "y": 0},
                    "data": {
                        "title": "報告", "content": "", "origin": "user",
                        "fileName": "report.pdf", "pageCount": 5, "pageUnit": "page",
                    },
                },
                create_concept_node({"documentStartPage": 1, "documentEndPage": 10}),
            ],
            "edges": [{"id": "edge-1", "source": "document-1", "target": "node-1", "data": {"origin": "user"}}],
            "messages": [],
        })


def test_upgrades_intermediate_file_node_to_document() -> None:
    document = ProjectDocument.model_validate({
        "version": 4,
        "nodes": [{
            "id": "legacy-file", "type": "file", "position": {"x": 0, "y": 0},
            "data": {"title": "舊文件", "content": "", "origin": "user", "fileName": "report.pdf"},
        }],
        "edges": [], "messages": [],
    })
    assert isinstance(document.nodes[0], ProjectDocumentNode)
    assert document.nodes[0].type == "document"


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


def create_audio_node(duration_ms: int | None = 90_000) -> dict[str, object]:
    data: dict[str, object] = {
        "title": "訪談錄音",
        "content": "",
        "origin": "user",
        "sourceType": "url",
        "source": "https://example.com/interview.mp3",
        "fileName": "interview.mp3",
        "mimeType": "audio/mpeg",
    }
    if duration_ms is not None:
        data["durationMs"] = duration_ms

    return {
        "id": "audio-1",
        "type": "audio",
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

    assert document.version == 4
    assert document.nodes == []
    assert document.suggestion_events == []


def test_accepts_expected_updated_at_for_optimistic_locking() -> None:
    update = ProjectUpdate.model_validate(
        {
            "name": "更新名稱",
            "expectedUpdatedAt": "2026-08-25T08:30:00.000Z",
        }
    )

    assert update.expected_updated_at is not None
    assert update.model_dump(by_alias=True)["expectedUpdatedAt"].isoformat() == (
        "2026-08-25T08:30:00+00:00"
    )


def test_normalizes_optional_project_version_name() -> None:
    named_version = ProjectVersionCreate.model_validate(
        {"name": "  訪談整理完成  "}
    )
    unnamed_version = ProjectVersionCreate.model_validate({"name": "   "})

    assert named_version.name == "訪談整理完成"
    assert unnamed_version.name is None


def test_accepts_client_project_version_kinds() -> None:
    automatic = ProjectVersionCreate.model_validate({"kind": "automatic"})
    pre_import = ProjectVersionCreate.model_validate({"kind": "pre_import"})

    assert automatic.kind == "automatic"
    assert pre_import.kind == "pre_import"


def test_rejects_client_created_pre_restore_version() -> None:
    with pytest.raises(ValidationError):
        ProjectVersionCreate.model_validate({"kind": "pre_restore"})


def test_accepts_project_version_restore_lock() -> None:
    request = ProjectVersionRestore.model_validate(
        {"expectedUpdatedAt": "2026-08-25T08:30:00.000Z"}
    )

    assert request.expected_updated_at is not None


def test_accepts_project_version_response() -> None:
    version = ProjectVersionResponse.model_validate(
        {
            "id": "a3c89b13-2640-4d58-a5c4-30fb3db79750",
            "name": "第一版",
            "kind": "manual",
            "createdAt": "2026-08-25T08:30:00.000Z",
            "document": {
                "version": 4,
                "nodes": [],
                "edges": [],
                "messages": [],
            },
        }
    )

    assert version.kind == "manual"
    assert version.document.version == 4


def test_accepts_suggestion_decision_event() -> None:
    document = ProjectDocument.model_validate(
        {
            "version": 4,
            "nodes": [],
            "edges": [],
            "messages": [],
            "suggestionEvents": [
                {
                    "id": "suggestion-event-1",
                    "action": "accepted",
                    "contextNodeId": "deleted-node",
                    "aiMode": "mock",
                    "edited": True,
                    "decisionTimeMs": 1250,
                    "nodeCount": 2,
                    "createdAt": "2026-08-24T00:00:00.000Z",
                }
            ],
        }
    )

    assert len(document.suggestion_events) == 1
    assert document.suggestion_events[0].edited is True


def test_accepts_optional_chat_message_author() -> None:
    document = ProjectDocument.model_validate(
        {
            "version": 4,
            "nodes": [],
            "edges": [],
            "messages": [
                {
                    "id": "message-1",
                    "role": "user",
                    "content": "協作訊息",
                    "contextNodeId": None,
                    "createdAt": "2026-08-28T00:00:00.000Z",
                    "authorId": "user-1",
                    "authorEmail": "user@example.com",
                    "authorName": "測試使用者",
                }
            ],
        }
    )

    assert document.messages[0].author_id == "user-1"
    assert document.messages[0].author_email == "user@example.com"
    assert document.messages[0].author_name == "測試使用者"


def test_accepts_video_node_before_source_is_configured() -> None:
    video_node = create_video_node()
    video_node["data"] = {**video_node["data"], "source": ""}

    document = ProjectDocument.model_validate(
        {"version": 4, "nodes": [video_node], "edges": [], "messages": []}
    )

    assert isinstance(document.nodes[0], ProjectVideoNode)
    assert document.nodes[0].data.source == ""


def test_accepts_concept_node_color_and_defaults_legacy_nodes() -> None:
    colored_document = ProjectDocument.model_validate(
        {
            "version": 4,
            "nodes": [create_concept_node({"color": "pink"})],
            "edges": [],
            "messages": [],
        }
    )
    legacy_document = ProjectDocument.model_validate(
        {
            "version": 4,
            "nodes": [create_concept_node({})],
            "edges": [],
            "messages": [],
        }
    )

    assert colored_document.nodes[0].data.color == "pink"
    assert legacy_document.nodes[0].data.color == "default"


def test_rejects_unknown_concept_node_color() -> None:
    with pytest.raises(ValidationError):
        ProjectDocument.model_validate(
            {
                "version": 4,
                "nodes": [create_concept_node({"color": "orange"})],
                "edges": [],
                "messages": [],
            }
        )


def test_accepts_group_node_and_member_parent_id() -> None:
    group = {
        "id": "group-1",
        "type": "group",
        "position": {"x": 40, "y": 80},
        "data": {
            "title": "訪談發現",
            "width": 640,
            "height": 360,
            "color": "green",
            "collapsed": True,
            "locked": True,
        },
    }
    concept = {
        **create_concept_node({}),
        "parentId": "group-1",
        "position": {"x": 32, "y": 64},
    }

    document = ProjectDocument.model_validate(
        {
            "version": 4,
            "nodes": [group, concept],
            "edges": [],
            "messages": [],
        }
    )

    assert isinstance(document.nodes[0], ProjectGroupNode)
    assert document.nodes[0].data.color == "green"
    assert document.nodes[0].data.collapsed is True
    assert document.nodes[0].data.locked is True
    assert document.nodes[1].parent_id == "group-1"


def test_rejects_member_with_missing_group() -> None:
    concept = {**create_concept_node({}), "parentId": "missing-group"}

    with pytest.raises(ValidationError, match="群組成員引用了不存在的群組"):
        ProjectDocument.model_validate(
            {
                "version": 4,
                "nodes": [concept],
                "edges": [],
                "messages": [],
            }
        )


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

    assert document.version == 4
    assert len(document.nodes) == 2
    assert isinstance(document.nodes[1], ProjectVideoNode)
    assert document.edges[0].source == "legacy-video"
    assert document.edges[0].target == "node-1"


def test_accepts_multiple_video_nodes_and_segment_binding() -> None:
    document = ProjectDocument.model_validate(
        {
            "version": 4,
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
                        "startTimeMs": 1_000,
                        "endTimeMs": 5_000,
                    }
                ),
            ],
            "edges": [
                {
                    "id": "video-link",
                    "source": "video-2",
                    "target": "node-1",
                    "data": {"origin": "user"},
                }
            ],
            "messages": [],
        }
    )

    assert document.edges[0].source == "video-2"


def test_accepts_audio_node_and_segment_binding() -> None:
    document = ProjectDocument.model_validate(
        {
            "version": 4,
            "nodes": [
                create_audio_node(),
                create_concept_node({"startTimeMs": 10_000, "endTimeMs": 30_000}),
            ],
            "edges": [
                {
                    "id": "audio-link",
                    "source": "audio-1",
                    "target": "node-1",
                    "data": {"origin": "user"},
                }
            ],
            "messages": [],
        }
    )

    assert isinstance(document.nodes[0], ProjectAudioNode)
    assert document.nodes[1].data.start_time_ms == 10_000


@pytest.mark.parametrize(
    ("node_data", "error_message"),
    [
        ({"startTimeMs": 1_000}, "開始與結束時間必須同時設定"),
        (
            {"startTimeMs": 5_000, "endTimeMs": 5_000},
            "結束時間必須晚於開始時間",
        ),
        (
            {"startTimeMs": 1_000, "endTimeMs": 2_000},
            "設定節點時間前必須先連接影片或音訊節點",
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
                "version": 4,
                "nodes": [create_video_node(), create_concept_node(node_data)],
                "edges": [],
                "messages": [],
            }
        )


def test_rejects_segment_past_bound_video_duration() -> None:
    with pytest.raises(ValidationError, match="節點時間不得超出影音長度"):
        ProjectDocument.model_validate(
            {
                "version": 4,
                "nodes": [
                    create_video_node(10_000),
                    create_concept_node(
                        {
                            "startTimeMs": 9_000,
                            "endTimeMs": 11_000,
                        }
                    ),
                ],
                "edges": [
                    {
                        "id": "video-link",
                        "source": "video-1",
                        "target": "node-1",
                        "data": {"origin": "user"},
                    }
                ],
                "messages": [],
            }
        )
