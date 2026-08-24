import hashlib
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GeminiVideoCache


VIDEO_CACHE_LIFETIME = timedelta(hours=47)


def create_credential_fingerprint(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def create_video_source_hash(source: str) -> str:
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


async def get_cached_video(
    session: AsyncSession,
    api_key: str,
    source: str,
) -> GeminiVideoCache | None:
    now = datetime.now(timezone.utc)
    await session.execute(
        delete(GeminiVideoCache).where(GeminiVideoCache.expires_at <= now)
    )
    cached_video = await session.scalar(
        select(GeminiVideoCache).where(
            GeminiVideoCache.credential_fingerprint
            == create_credential_fingerprint(api_key),
            GeminiVideoCache.source_hash == create_video_source_hash(source),
            GeminiVideoCache.expires_at > now,
        )
    )
    await session.commit()
    return cached_video


async def store_cached_video(
    session: AsyncSession,
    api_key: str,
    source: str,
    file_name: str,
    file_uri: str,
    mime_type: str,
) -> None:
    now = datetime.now(timezone.utc)
    values = {
        "credential_fingerprint": create_credential_fingerprint(api_key),
        "source_hash": create_video_source_hash(source),
        "file_name": file_name,
        "file_uri": file_uri,
        "mime_type": mime_type,
        "expires_at": now + VIDEO_CACHE_LIFETIME,
        "updated_at": now,
    }
    statement = insert(GeminiVideoCache).values(**values)
    statement = statement.on_conflict_do_update(
        constraint="uq_gemini_video_caches_credential_source",
        set_=values,
    )
    await session.execute(statement)
    await session.commit()


async def remove_cached_video(
    session: AsyncSession,
    cached_video: GeminiVideoCache,
) -> None:
    await session.delete(cached_video)
    await session.commit()
