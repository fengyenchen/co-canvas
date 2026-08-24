import asyncio
import ipaddress
import os
import socket
import tempfile
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse, parse_qsl, urlencode

import httpx


MAX_VIDEO_MB = 450
MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024
MAX_REDIRECTS = 5
SUPPORTED_VIDEO_FORMATS = {
    ".mp4": "video/mp4",
    ".mov": "video/mov",
}


class VideoSourceError(ValueError):
    pass


def get_video_source_error(source: str, provider: str) -> str | None:
    if provider not in {"Dropbox", "直接影片網址"}:
        return None

    try:
        parsed = urlparse(source)
    except ValueError:
        return "影片網址格式無效"

    hostname = (parsed.hostname or "").lower().removeprefix("www.")
    if provider == "Dropbox" or hostname == "dropbox.com":
        if parsed.path.startswith("/scl/fo/"):
            return (
                "Dropbox 資料夾或預覽連結無法提供給 Gemini，"
                "請分享 MP4 或 MOV 檔案本身的連結"
            )
        if get_supported_video_mime_type(source) is None:
            return "Dropbox 影片分析目前只支援 MP4 或 MOV 檔案分享連結"
        return "Dropbox 分享連結無效，請重新建立影片檔案的分享連結"

    return "這個影片網址無法提供給 Gemini，目前只支援公開 HTTPS MP4 或 MOV"


def get_supported_video_mime_type(source: str) -> str | None:
    try:
        path = urlparse(source).path.lower()
    except ValueError:
        return None
    return next(
        (
            mime_type
            for suffix, mime_type in SUPPORTED_VIDEO_FORMATS.items()
            if path.endswith(suffix)
        ),
        None,
    )


def get_supported_video_suffix(source: str) -> str | None:
    try:
        path = urlparse(source).path.lower()
    except ValueError:
        return None
    return next(
        (suffix for suffix in SUPPORTED_VIDEO_FORMATS if path.endswith(suffix)),
        None,
    )


def normalize_downloadable_video_url(source: str) -> str | None:
    try:
        parsed = urlparse(source)
    except ValueError:
        return None

    if parsed.scheme != "https" or not parsed.hostname:
        return None

    hostname = parsed.hostname.lower().removeprefix("www.")
    is_dropbox_file = hostname == "dropbox.com" and (
        parsed.path.startswith("/s/") or parsed.path.startswith("/scl/fi/")
    )

    if is_dropbox_file:
        if get_supported_video_mime_type(source) is None:
            return None
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query.pop("dl", None)
        query["raw"] = "1"
        return urlunparse(parsed._replace(query=urlencode(query)))

    if get_supported_video_mime_type(source) is not None:
        return source

    return None


def supports_chat_video_source(source: str | None) -> bool:
    if not source:
        return False
    normalized = source.lower()
    return (
        "youtube.com/" in normalized
        or "youtu.be/" in normalized
        or normalize_downloadable_video_url(source) is not None
    )


async def _validate_public_host(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise VideoSourceError("影片網址必須是公開的 HTTPS 網址")

    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo,
            parsed.hostname,
            parsed.port or 443,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as error:
        raise VideoSourceError("無法解析影片網址") from error

    if not addresses:
        raise VideoSourceError("無法解析影片網址")

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise VideoSourceError("影片網址不可指向本機或私人網路")


async def download_video_file(source: str) -> Path:
    current_url = normalize_downloadable_video_url(source)
    if current_url is None:
        raise VideoSourceError("目前只支援公開或 Dropbox 的 MP4、MOV 分享連結")

    source_mime_type = get_supported_video_mime_type(source)
    source_suffix = get_supported_video_suffix(source)
    if source_mime_type is None or source_suffix is None:
        raise VideoSourceError("無法辨識影片檔案格式")

    temporary_path: Path | None = None

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(90, connect=10),
            follow_redirects=False,
            headers={"User-Agent": "Co-Canvas/1.0"},
        ) as client:
            for _ in range(MAX_REDIRECTS + 1):
                await _validate_public_host(current_url)

                async with client.stream("GET", current_url) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location:
                            raise VideoSourceError("影片下載重新導向無效")
                        current_url = urljoin(current_url, location)
                        continue

                    response.raise_for_status()
                    content_length = response.headers.get("content-length")
                    if content_length:
                        try:
                            exceeds_limit = int(content_length) > MAX_VIDEO_BYTES
                        except ValueError:
                            exceeds_limit = False
                        if exceeds_limit:
                            file_size_mb = int(content_length) / 1024 / 1024
                            raise VideoSourceError(
                                f"影片檔案約 {file_size_mb:.0f} MB，"
                                f"超過 {MAX_VIDEO_MB} MB 限制"
                            )

                    content_type = response.headers.get("content-type", "")
                    mime_type = content_type.split(";", 1)[0].strip().lower()
                    accepted_mime_types = {
                        source_mime_type,
                        "video/quicktime" if source_suffix == ".mov" else None,
                        "application/octet-stream",
                    }
                    if mime_type not in accepted_mime_types:
                        raise VideoSourceError("影片來源不是支援的 MP4 或 MOV 檔案")

                    with tempfile.NamedTemporaryFile(
                        mode="wb",
                        suffix=source_suffix,
                        delete=False,
                    ) as temporary_file:
                        temporary_path = Path(temporary_file.name)
                        downloaded_bytes = 0
                        async for chunk in response.aiter_bytes():
                            downloaded_bytes += len(chunk)
                            if downloaded_bytes > MAX_VIDEO_BYTES:
                                raise VideoSourceError(
                                    f"影片檔案超過 {MAX_VIDEO_MB} MB 限制"
                                )
                            temporary_file.write(chunk)

                    if downloaded_bytes == 0:
                        raise VideoSourceError("影片檔案是空的")
                    return temporary_path

            raise VideoSourceError("影片下載重新導向次數過多")
    except httpx.HTTPError as error:
        raise VideoSourceError("無法下載影片檔案") from error
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise


def remove_temporary_video(path: Path | None) -> None:
    if path is not None:
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass
