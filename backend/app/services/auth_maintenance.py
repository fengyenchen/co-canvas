import hashlib
import hmac
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import quote

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.settings import Settings


class AuthSchemaError(RuntimeError):
    pass


class NeonAuthDeletionError(RuntimeError):
    pass


@dataclass(frozen=True)
class AuthUserRecord:
    id: str
    email: str
    email_verified: bool
    created_at: datetime


@dataclass(frozen=True)
class AuthUserTable:
    table: str
    id_column: str
    email_column: str
    verified_column: str
    created_column: str
    deleted_column: str | None = None


def hash_auth_identifier(value: str, settings: Settings) -> str:
    normalized = value.strip().lower().encode()
    secret = settings.auth_audit_hash_secret or settings.auth_cleanup_secret
    if secret is None:
        return hashlib.sha256(normalized).hexdigest()
    return hmac.new(
        secret.get_secret_value().encode(),
        normalized,
        hashlib.sha256,
    ).hexdigest()


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


async def discover_auth_user_table(session: AsyncSession) -> AuthUserTable:
    cached = session.info.get("auth_user_table")
    if isinstance(cached, AuthUserTable):
        return cached

    rows = (
        await session.execute(
            text(
                """
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'neon_auth'
                  AND table_name IN ('user', 'users_sync')
                """
            )
        )
    ).all()
    columns_by_table: dict[str, set[str]] = {}
    for table_name, column_name in rows:
        columns_by_table.setdefault(table_name, set()).add(column_name)

    aliases = {
        "id": ("id",),
        "email": ("email",),
        "verified": ("emailVerified", "email_verified"),
        "created": ("createdAt", "created_at"),
        "deleted": ("deletedAt", "deleted_at"),
    }

    for table_name in ("user", "users_sync"):
        columns = columns_by_table.get(table_name, set())

        def first_available(kind: str) -> str | None:
            return next(
                (name for name in aliases[kind] if name in columns),
                None,
            )

        id_column = first_available("id")
        email_column = first_available("email")
        verified_column = first_available("verified")
        created_column = first_available("created")
        if all((id_column, email_column, verified_column, created_column)):
            discovered = AuthUserTable(
                table=table_name,
                id_column=id_column,
                email_column=email_column,
                verified_column=verified_column,
                created_column=created_column,
                deleted_column=first_available("deleted"),
            )
            session.info["auth_user_table"] = discovered
            return discovered

    raise AuthSchemaError(
        "找不到包含 email 驗證狀態與建立時間的 Neon Auth 使用者資料表"
    )


def _select_columns(table: AuthUserTable) -> str:
    return ", ".join(
        (
            f"{_quote_identifier(table.id_column)} AS id",
            f"{_quote_identifier(table.email_column)} AS email",
            f"{_quote_identifier(table.verified_column)} AS email_verified",
            f"{_quote_identifier(table.created_column)} AS created_at",
        )
    )


def _active_clause(table: AuthUserTable) -> str:
    if table.deleted_column is None:
        return "TRUE"
    return f"{_quote_identifier(table.deleted_column)} IS NULL"


def _to_record(row: object | None) -> AuthUserRecord | None:
    if row is None:
        return None
    mapping = row._mapping  # type: ignore[attr-defined]
    return AuthUserRecord(
        id=str(mapping["id"]),
        email=str(mapping["email"]).strip().lower(),
        email_verified=bool(mapping["email_verified"]),
        created_at=mapping["created_at"],
    )


async def find_auth_user_by_email(
    session: AsyncSession,
    email: str,
) -> AuthUserRecord | None:
    table = await discover_auth_user_table(session)
    statement = text(
        f"""
        SELECT {_select_columns(table)}
        FROM neon_auth.{_quote_identifier(table.table)}
        WHERE lower({_quote_identifier(table.email_column)}) = :email
          AND {_active_clause(table)}
        LIMIT 1
        """
    )
    row = (
        await session.execute(statement, {"email": email.strip().lower()})
    ).first()
    return _to_record(row)


async def find_auth_user_by_id(
    session: AsyncSession,
    user_id: str,
) -> AuthUserRecord | None:
    table = await discover_auth_user_table(session)
    statement = text(
        f"""
        SELECT {_select_columns(table)}
        FROM neon_auth.{_quote_identifier(table.table)}
        WHERE {_quote_identifier(table.id_column)} = :user_id
          AND {_active_clause(table)}
        LIMIT 1
        """
    )
    row = (await session.execute(statement, {"user_id": user_id})).first()
    return _to_record(row)


async def list_expired_unverified_users(
    session: AsyncSession,
    cutoff: datetime,
    limit: int,
) -> list[AuthUserRecord]:
    table = await discover_auth_user_table(session)
    statement = text(
        f"""
        SELECT {_select_columns(table)}
        FROM neon_auth.{_quote_identifier(table.table)}
        WHERE {_quote_identifier(table.verified_column)} IS NOT TRUE
          AND {_quote_identifier(table.created_column)} < :cutoff
          AND {_active_clause(table)}
        ORDER BY {_quote_identifier(table.created_column)} ASC
        LIMIT :limit
        """
    )
    rows = (
        await session.execute(statement, {"cutoff": cutoff, "limit": limit})
    ).all()
    records: list[AuthUserRecord] = []
    for row in rows:
        record = _to_record(row)
        if record is not None:
            records.append(record)
    return records


async def list_auth_users(
    session: AsyncSession,
    limit: int = 500,
) -> list[AuthUserRecord]:
    table = await discover_auth_user_table(session)
    statement = text(
        f"""
        SELECT {_select_columns(table)}
        FROM neon_auth.{_quote_identifier(table.table)}
        WHERE {_active_clause(table)}
        ORDER BY {_quote_identifier(table.created_column)} DESC
        LIMIT :limit
        """
    )
    rows = (await session.execute(statement, {"limit": limit})).all()
    return [record for row in rows if (record := _to_record(row)) is not None]


async def delete_neon_auth_user(
    user_id: str,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> bool:
    if not settings.neon_api_key:
        raise NeonAuthDeletionError("NEON_API_KEY 尚未設定")
    if not settings.neon_project_id or not settings.neon_branch_id:
        raise NeonAuthDeletionError("NEON_PROJECT_ID 或 NEON_BRANCH_ID 尚未設定")

    url = (
        "https://console.neon.tech/api/v2/projects/"
        f"{quote(settings.neon_project_id, safe='')}/branches/"
        f"{quote(settings.neon_branch_id, safe='')}/auth/users/"
        f"{quote(user_id, safe='')}"
    )
    owns_client = client is None
    request_client = client or httpx.AsyncClient(timeout=15)
    try:
        response = await request_client.delete(
            url,
            headers={
                "Authorization": (
                    f"Bearer {settings.neon_api_key.get_secret_value()}"
                )
            },
        )
    finally:
        if owns_client:
            await request_client.aclose()

    if response.status_code == 204:
        return True
    if response.status_code == 404:
        return False
    raise NeonAuthDeletionError(
        f"Neon Auth 刪除使用者失敗（HTTP {response.status_code}）"
    )
