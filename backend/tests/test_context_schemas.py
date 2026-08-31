import pytest
from pathlib import Path
from pydantic import ValidationError

from app.schemas import ChatRequest, ContextNode
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.services.gemini import (
    GeminiUploadStartError,
    build_chat_parts,
    forward_gemini_upload_chunk,
    upload_chat_video_clip,
    upload_chat_file,
)


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


def test_accepts_uploaded_local_video_reference() -> None:
    request = ChatRequest.model_validate(
        {
            "prompt": "分析本機影片",
            "selectedNode": {
                "id": "concept-1",
                "title": "片段",
                "startTimeMs": 0,
                "endTimeMs": 10_000,
                "linkedVideo": {
                    "id": "video-1",
                    "title": "本機影片",
                    "provider": "尚未設定",
                    "source": "",
                },
            },
            "uploadedVideo": {"name": "files/local_video_123"},
        }
    )

    assert request.uploaded_video is not None
    assert request.uploaded_video.name == "files/local_video_123"


def test_accepts_uploaded_document_reference() -> None:
    request = ChatRequest.model_validate({
        "prompt": "摘要這份文件",
        "selectedNode": {"id": "document-1", "title": "研究報告", "nodeType": "document", "fileName": "report.pdf", "mimeType": "application/pdf"},
        "uploadedFile": {"name": "files/local_document_123"},
    })
    assert request.uploaded_file is not None
    assert request.selected_node is not None
    assert request.selected_node.node_type == "document"


def test_accepts_uploaded_audio_reference_and_time_range() -> None:
    request = ChatRequest.model_validate({
        "prompt": "整理這段訪談",
        "selectedNode": {
            "id": "concept-1",
            "title": "訪談片段",
            "startTimeMs": 10_000,
            "endTimeMs": 30_000,
            "linkedFile": {
                "id": "audio-1",
                "title": "訪談錄音",
                "nodeType": "audio",
                "fileName": "interview.mp3",
                "mimeType": "audio/mpeg",
                "durationMs": 90_000,
            },
        },
        "uploadedFile": {"name": "files/local_audio_123"},
    })

    parts = build_chat_parts(
        request,
        "（尚無先前對話）",
        SimpleNamespace(file_data=SimpleNamespace(mime_type="audio/mpeg")),
    )

    assert request.selected_node.linked_file.node_type == "audio"
    assert "指定分析音訊 10–30 秒" in parts[1].text


@pytest.mark.anyio
async def test_attaches_public_image_url(monkeypatch, tmp_path: Path) -> None:
    request = ChatRequest.model_validate({
        "prompt": "描述圖片",
        "selectedNode": {"id": "image-1", "title": "流程圖", "nodeType": "image", "fileSource": "https://example.com/flow.png", "mimeType": "image/png"},
    })
    temporary_file = tmp_path / "flow.png"
    temporary_file.write_bytes(b"image")
    async def fake_download(_source: str):
        return temporary_file, "image/png"
    monkeypatch.setattr("app.services.gemini.download_file_source", fake_download)
    uploaded = SimpleNamespace(uri="https://files.example/flow", mime_type="image/png", state=SimpleNamespace(name="ACTIVE"))
    client = SimpleNamespace(files=SimpleNamespace(upload=AsyncMock(return_value=uploaded)))
    part = await upload_chat_file(client, request)
    assert part is not None
    assert part.file_data.file_uri == "https://files.example/flow"
    assert part.file_data.mime_type == "image/png"


@pytest.mark.anyio
async def test_attaches_uploaded_local_video_clip() -> None:
    request = ChatRequest.model_validate(
        {
            "prompt": "這段影片在說什麼？",
            "selectedNode": {
                "id": "concept-1",
                "title": "片段",
                "startTimeMs": 2_000,
                "endTimeMs": 12_000,
                "linkedVideo": {
                    "id": "video-1",
                    "title": "本機影片",
                    "provider": "尚未設定",
                    "source": "",
                },
            },
            "uploadedVideo": {"name": "files/local_video_123"},
        }
    )
    uploaded_file = SimpleNamespace(
        name="files/local_video_123",
        uri="https://generativelanguage.googleapis.com/v1beta/files/local_video_123",
        mime_type="video/mov",
        state=SimpleNamespace(name="ACTIVE"),
    )
    client = SimpleNamespace(
        files=SimpleNamespace(get=AsyncMock(return_value=uploaded_file)),
    )

    part = await upload_chat_video_clip(
        client,
        request,
        "test-key",
        AsyncMock(),
    )

    assert part is not None
    assert part.file_data.mime_type == "video/mov"
    assert part.video_metadata.start_offset == "2.0s"
    assert part.video_metadata.end_offset == "12.0s"

    parts = build_chat_parts(
        request,
        "（尚無先前對話）",
        part,
    )
    assert "本次請求已附上可直接讀取的影片檔案" in parts[1].text
    assert "不代表影片未附上" in parts[1].text


@pytest.mark.anyio
async def test_rejects_untrusted_gemini_upload_url() -> None:
    with pytest.raises(GeminiUploadStartError) as error:
        await forward_gemini_upload_chunk(
            "https://example.com/upload/video",
            0,
            b"video",
            True,
        )

    assert error.value.status_code == 400


@pytest.mark.anyio
async def test_forwards_and_finalizes_gemini_upload_chunk(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, headers, content):
            captured.update(url=url, headers=headers, content=content)
            return SimpleNamespace(
                status_code=200,
                is_success=True,
                json=lambda: {"file": {"name": "files/video_123"}},
            )

    monkeypatch.setattr(
        "app.services.gemini.httpx.AsyncClient",
        lambda **_kwargs: FakeClient(),
    )

    file_name = await forward_gemini_upload_chunk(
        "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=abc",
        1_500_000,
        b"video-chunk",
        True,
    )

    assert file_name == "files/video_123"
    assert captured["content"] == b"video-chunk"
    assert captured["headers"] == {
        "Content-Type": "application/octet-stream",
        "X-Goog-Upload-Offset": "1500000",
        "X-Goog-Upload-Command": "upload, finalize",
    }


@pytest.mark.anyio
async def test_accepts_resume_incomplete_for_non_final_chunk(monkeypatch) -> None:
    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return SimpleNamespace(status_code=308, is_success=False)

    monkeypatch.setattr(
        "app.services.gemini.httpx.AsyncClient",
        lambda **_kwargs: FakeClient(),
    )

    file_name = await forward_gemini_upload_chunk(
        "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=abc",
        0,
        b"video-chunk",
        False,
    )

    assert file_name is None


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
