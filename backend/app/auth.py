from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app.settings import get_settings


class AuthenticatedUser(BaseModel):
    id: str
    email: str | None = None


bearer_scheme = HTTPBearer(auto_error=False)
BearerCredentials = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(bearer_scheme),
]


@lru_cache
def get_jwks_client() -> PyJWKClient:
    jwks_url = get_settings().neon_auth_jwks_url

    if jwks_url is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Neon Auth 尚未設定",
        )

    return PyJWKClient(str(jwks_url), cache_keys=True)


def decode_token(token: str) -> dict[str, Any]:
    signing_key = get_jwks_client().get_signing_key_from_jwt(token)

    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["EdDSA", "ES256", "RS256"],
        options={
            "require": ["exp", "sub"],
            "verify_aud": False,
        },
    )


async def get_current_user(
    credentials: BearerCredentials,
) -> AuthenticatedUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="請先登入",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = await run_in_threadpool(
            decode_token,
            credentials.credentials,
        )
    except (InvalidTokenError, PyJWKClientError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登入憑證無效或已過期",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    user_id = payload.get("sub")
    email = payload.get("email")

    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登入憑證缺少使用者識別碼",
            headers={"WWW-Authenticate": "Bearer"},
        )

    normalized_email = (
        email.strip().lower()
        if isinstance(email, str) and email.strip()
        else None
    )

    return AuthenticatedUser(id=user_id, email=normalized_email)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


async def get_optional_current_user(
    credentials: BearerCredentials,
) -> AuthenticatedUser | None:
    if credentials is None:
        return None

    return await get_current_user(credentials)


OptionalCurrentUser = Annotated[
    AuthenticatedUser | None,
    Depends(get_optional_current_user),
]
