import asyncio
import ipaddress
import socket
import tempfile
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx

from app.services.video_source import VideoSourceError

MAX_FILE_BYTES = 100 * 1024 * 1024
MAX_REDIRECTS = 5
MIME_BY_SUFFIX = {
    ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown",
    ".markdown": "text/markdown", ".csv": "text/csv", ".json": "application/json",
    ".html": "text/html", ".css": "text/css", ".xml": "text/xml", ".rtf": "text/rtf",
    ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp", ".bmp": "image/bmp",
    ".heic": "image/heic", ".heif": "image/heif",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def get_file_source_type(source: str) -> tuple[str, str] | None:
    try:
        suffix = Path(urlparse(source).path).suffix.lower()
    except ValueError:
        return None
    mime_type = MIME_BY_SUFFIX.get(suffix)
    return (suffix, mime_type) if mime_type else None


async def _validate_public_host(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise VideoSourceError("文件與圖片網址必須是公開的 HTTPS 網址")
    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo, parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM
        )
    except socket.gaierror as error:
        raise VideoSourceError("無法解析文件或圖片網址") from error
    if not addresses:
        raise VideoSourceError("無法解析文件或圖片網址")
    for address in addresses:
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise VideoSourceError("網址不可指向本機或私人網路")


async def download_file_source(source: str) -> tuple[Path, str]:
    source_type = get_file_source_type(source)
    if source_type is None:
        raise VideoSourceError("網址必須直接指向支援的文件或圖片格式")
    suffix, mime_type = source_type
    current_url = source
    temporary_path: Path | None = None
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(90, connect=10), follow_redirects=False,
            headers={"User-Agent": "Co-Canvas/1.0"},
        ) as client:
            for _ in range(MAX_REDIRECTS + 1):
                await _validate_public_host(current_url)
                async with client.stream("GET", current_url) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location:
                            raise VideoSourceError("檔案下載重新導向無效")
                        current_url = urljoin(current_url, location)
                        continue
                    response.raise_for_status()
                    length = response.headers.get("content-length")
                    effective_limit = 50 * 1024 * 1024 if suffix == ".pdf" else MAX_FILE_BYTES
                    if length and length.isdigit() and int(length) > effective_limit:
                        raise VideoSourceError("文件或圖片超過 100 MB 限制")
                    with tempfile.NamedTemporaryFile(mode="wb", suffix=suffix, delete=False) as output:
                        temporary_path = Path(output.name)
                        downloaded = 0
                        async for chunk in response.aiter_bytes():
                            downloaded += len(chunk)
                            if downloaded > effective_limit:
                                raise VideoSourceError("PDF 超過 50 MB 限制" if suffix == ".pdf" else "文件或圖片超過 100 MB 限制")
                            output.write(chunk)
                    if downloaded == 0:
                        raise VideoSourceError("文件或圖片是空的")
                    return temporary_path, mime_type
            raise VideoSourceError("檔案下載重新導向次數過多")
    except httpx.HTTPError as error:
        raise VideoSourceError("無法下載文件或圖片") from error
    except Exception:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise
