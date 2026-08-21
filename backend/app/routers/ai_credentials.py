import asyncio
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from google.genai.errors import APIError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_credential_schemas import (
    AiCredentialResponse,
    AiCredentialUpsert,
    AiCredentialValidationResult,
)
from app.auth import CurrentUser
from app.database import get_database_session
from app.models import UserAiCredential
from app.services.ai_credentials import (
    AiCredentialConfigurationError,
    get_api_key_cipher,
    get_api_key_hint,
)
from app.services.gemini import validate_gemini_api_key


router = APIRouter(
    prefix="/api/me/ai-credentials",
    tags=["ai-credentials"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_database_session),
]


async def get_gemini_credential(
    session: AsyncSession,
    user_id: str,
) -> UserAiCredential | None:
    return await session.scalar(
        select(UserAiCredential).where(
            UserAiCredential.user_id == user_id,
            UserAiCredential.provider == "gemini",
        ),
    )


def to_credential_response(
    credential: UserAiCredential | None,
    validation_result: AiCredentialValidationResult | None = None,
) -> AiCredentialResponse:
    if credential is None:
        return AiCredentialResponse(configured=False)

    return AiCredentialResponse(
        configured=True,
        key_hint=credential.key_hint,
        status=credential.status,
        last_validated_at=credential.last_validated_at,
        updated_at=credential.updated_at,
        validation_result=(
            validation_result
            or (
                credential.status
                if credential.status in ("valid", "invalid")
                else None
            )
        ),
    )


async def validate_api_key(
    api_key: str,
) -> AiCredentialValidationResult:
    try:
        async with asyncio.timeout(15):
            await validate_gemini_api_key(api_key)
    except APIError as error:
        if error.code in (400, 401, 403):
            return "invalid"

        if error.code == 429:
            return "quota_exceeded"

        return "unavailable"
    except (TimeoutError, RuntimeError, ValueError):
        return "unavailable"

    return "valid"


@router.get("/gemini", response_model=AiCredentialResponse)
async def get_gemini_credential_settings(
    session: DatabaseSession,
    user: CurrentUser,
) -> AiCredentialResponse:
    credential = await get_gemini_credential(session, user.id)
    return to_credential_response(credential)


@router.put("/gemini", response_model=AiCredentialResponse)
async def set_gemini_credential(
    request: AiCredentialUpsert,
    session: DatabaseSession,
    user: CurrentUser,
) -> AiCredentialResponse:
    api_key = request.api_key.get_secret_value().strip()

    try:
        encrypted_api_key = get_api_key_cipher().encrypt(api_key)
    except AiCredentialConfigurationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="使用者 API Key 加密服務尚未設定",
        ) from error

    validation_result = await validate_api_key(api_key)
    credential_status = (
        validation_result
        if validation_result in ("valid", "invalid")
        else "unverified"
    )
    validated_at = datetime.now(timezone.utc)

    credential = await get_gemini_credential(session, user.id)

    if credential is None:
        credential = UserAiCredential(
            user_id=user.id,
            provider="gemini",
            encrypted_api_key=encrypted_api_key,
            key_hint=get_api_key_hint(api_key),
            status=credential_status,
            last_validated_at=validated_at,
        )
        session.add(credential)
    else:
        credential.encrypted_api_key = encrypted_api_key
        credential.key_hint = get_api_key_hint(api_key)
        credential.status = credential_status
        credential.last_validated_at = validated_at

    await session.commit()
    await session.refresh(credential)

    return to_credential_response(credential, validation_result)


@router.delete(
    "/gemini",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_gemini_credential(
    session: DatabaseSession,
    user: CurrentUser,
) -> Response:
    credential = await get_gemini_credential(session, user.id)

    if credential is not None:
        await session.delete(credential)
        await session.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
