from app.services.video_source import (
    get_video_source_error,
    normalize_downloadable_video_url,
    supports_chat_video_source,
)


def test_normalizes_dropbox_mp4_share_link() -> None:
    source = (
        "https://www.dropbox.com/scl/fi/token/video.mp4"
        "?rlkey=key&dl=0"
    )

    normalized = normalize_downloadable_video_url(source)

    assert normalized is not None
    assert "raw=1" in normalized
    assert "dl=" not in normalized


def test_accepts_public_mp4_and_youtube_sources() -> None:
    assert supports_chat_video_source("https://example.com/video.mp4")
    assert supports_chat_video_source(
        "https://www.dropbox.com/scl/fi/token/.MOV?dl=0"
    )
    assert supports_chat_video_source("https://youtu.be/example")


def test_rejects_unsupported_or_insecure_sources() -> None:
    assert not supports_chat_video_source("http://example.com/video.mp4")
    assert not supports_chat_video_source("https://vimeo.com/123")
    assert not supports_chat_video_source(
        "https://www.dropbox.com/scl/fi/token/video.avi?dl=0"
    )


def test_explains_dropbox_folder_and_non_mp4_links() -> None:
    assert get_video_source_error(
        "https://www.dropbox.com/scl/fo/token/folder?preview=video.mp4",
        "Dropbox",
    ) == (
        "Dropbox 資料夾或預覽連結無法提供給 Gemini，"
        "請分享 MP4 或 MOV 檔案本身的連結"
    )
    assert get_video_source_error(
        "https://www.dropbox.com/scl/fi/token/video.ts?dl=0",
        "Dropbox",
    ) == "Dropbox 影片分析目前只支援 MP4 或 MOV 檔案分享連結"
