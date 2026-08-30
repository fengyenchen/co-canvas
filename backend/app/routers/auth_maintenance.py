import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.database import get_database_session
from app.models import ResendWebhookEvent
from app.services.auth_maintenance import (
    AuthSchemaError,
    NeonAuthDeletionError,
    delete_neon_auth_user,
    find_auth_user_by_email,
    find_auth_user_by_id,
    list_expired_unverified_users,
)
from app.settings import get_settings


logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth-maintenance"])
DatabaseSession = Annotated[AsyncSession, Depends(get_database_session)]


def _email_hash(emails: list[str]) -> str | None:
    normalized = sorted(
        {email.strip().lower() for email in emails if email.strip()}
    )
    if not normalized:
        return None
    return hashlib.sha256("\n".join(normalized).encode()).hexdigest()


def _parse_resend_event(raw_body: bytes, headers: dict[str, str]) -> dict[str, Any]:
    settings = get_settings()
    if settings.resend_webhook_secret is None:
        raise HTTPException(status_code=503, detail="Resend webhook 尚未設定")

    try:
        Webhook(settings.resend_webhook_secret.get_secret_value()).verify(
            raw_body,
            headers,
        )
        event = json.loads(raw_body)
    except (WebhookVerificationError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=400, detail="Resend webhook 簽章無效") from error

    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Resend webhook 格式無效")
    return event


async def _record_webhook_event(
    session: AsyncSession,
    svix_id: str,
    event_type: str,
    recipients: list[str],
    outcome: str,
) -> bool:
    session.add(
        ResendWebhookEvent(
            svix_id=svix_id,
            event_type=event_type,
            email_hash=_email_hash(recipients),
            outcome=outcome,
        )
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        return False
    return True


@router.post("/api/webhooks/resend")
async def receive_resend_webhook(
    request: Request,
    session: DatabaseSession,
) -> dict[str, Any]:
    svix_id = request.headers.get("svix-id")
    svix_timestamp = request.headers.get("svix-timestamp")
    svix_signature = request.headers.get("svix-signature")
    if not all((svix_id, svix_timestamp, svix_signature)):
        raise HTTPException(status_code=400, detail="缺少 Resend webhook 簽章標頭")

    raw_body = await request.body()
    event = _parse_resend_event(
        raw_body,
        {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        },
    )
    existing = await session.get(ResendWebhookEvent, svix_id)
    if existing is not None:
        return {"status": "duplicate"}

    event_type = str(event.get("type", ""))
    if event_type != "email.bounced":
        return {"status": "ignored"}

    data = event.get("data")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Resend bounce 資料格式無效")
    bounce = data.get("bounce")
    if not isinstance(bounce, dict) or bounce.get("type") != "Permanent":
        await _record_webhook_event(
            session,
            svix_id,
            event_type,
            [],
            "non_permanent_ignored",
        )
        return {"status": "ignored"}

    raw_recipients = data.get("to")
    if not isinstance(raw_recipients, list):
        raise HTTPException(status_code=400, detail="Resend bounce 收件者格式無效")
    recipients = [
        value.strip().lower()
        for value in raw_recipients
        if isinstance(value, str) and value.strip()
    ]
    if not recipients:
        raise HTTPException(status_code=400, detail="Resend bounce 缺少收件者")

    settings = get_settings()
    deleted = 0
    verified_ignored = 0
    missing = 0
    try:
        for email in recipients:
            user = await find_auth_user_by_email(session, email)
            if user is None:
                missing += 1
                continue
            if user.email_verified:
                verified_ignored += 1
                continue

            # Re-read immediately before the external delete to minimize races with
            # a verification request completing at the same time.
            current = await find_auth_user_by_id(session, user.id)
            if current is None:
                missing += 1
                continue
            if current.email_verified:
                verified_ignored += 1
                continue
            if await delete_neon_auth_user(current.id, settings):
                deleted += 1
            else:
                missing += 1
    except (AuthSchemaError, NeonAuthDeletionError) as error:
        logger.exception("Unable to process Resend permanent bounce")
        raise HTTPException(status_code=503, detail=str(error)) from error

    outcome = (
        f"deleted:{deleted};verified_ignored:{verified_ignored};missing:{missing}"
    )
    was_recorded = await _record_webhook_event(
        session,
        svix_id,
        event_type,
        recipients,
        outcome,
    )
    return {
        "status": "processed" if was_recorded else "duplicate",
        "deleted": deleted,
        "verifiedIgnored": verified_ignored,
    }


@router.post("/api/internal/auth/cleanup-unverified")
async def cleanup_unverified_users(
    session: DatabaseSession,
    cleanup_secret: Annotated[
        str | None,
        Header(alias="X-Cleanup-Secret"),
    ] = None,
) -> dict[str, int | str]:
    settings = get_settings()
    expected_secret = settings.auth_cleanup_secret
    if expected_secret is None:
        raise HTTPException(status_code=503, detail="帳號清理排程尚未設定")
    if cleanup_secret is None or not hmac.compare_digest(
        cleanup_secret,
        expected_secret.get_secret_value(),
    ):
        raise HTTPException(status_code=401, detail="清理排程憑證無效")

    cutoff = datetime.now(timezone.utc) - timedelta(
        hours=settings.auth_unverified_retention_hours
    )
    try:
        candidates = await list_expired_unverified_users(
            session,
            cutoff,
            settings.auth_cleanup_batch_size,
        )
        deleted = 0
        skipped = 0
        for candidate in candidates:
            current = await find_auth_user_by_id(session, candidate.id)
            if (
                current is None
                or current.email_verified
                or current.created_at >= cutoff
            ):
                skipped += 1
                continue
            if await delete_neon_auth_user(current.id, settings):
                deleted += 1
            else:
                skipped += 1
    except (AuthSchemaError, NeonAuthDeletionError) as error:
        logger.exception("Unable to clean up unverified auth users")
        raise HTTPException(status_code=503, detail=str(error)) from error

    return {
        "status": "completed",
        "candidates": len(candidates),
        "deleted": deleted,
        "skipped": skipped,
    }
