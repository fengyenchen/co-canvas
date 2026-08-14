import asyncio
from collections.abc import AsyncIterator
from functools import lru_cache

from psycopg import AsyncConnection, Error as PsycopgError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.settings import get_settings


class DatabaseConnectionError(RuntimeError):
    pass


class DatabaseConfigurationError(RuntimeError):
    pass


class Base(DeclarativeBase):
    pass


def to_sqlalchemy_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return database_url.replace(
            "postgresql://",
            "postgresql+psycopg://",
            1,
        )

    if database_url.startswith("postgres://"):
        return database_url.replace(
            "postgres://",
            "postgresql+psycopg://",
            1,
        )

    return database_url


@lru_cache
def get_database_engine() -> AsyncEngine:
    database_url = get_settings().database_url

    if database_url is None:
        raise DatabaseConfigurationError("DATABASE_URL 尚未設定")

    return create_async_engine(
        to_sqlalchemy_url(database_url.get_secret_value()),
        pool_pre_ping=True,
    )


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        get_database_engine(),
        expire_on_commit=False,
    )


async def get_database_session() -> AsyncIterator[AsyncSession]:
    async with get_session_factory()() as session:
        yield session


async def check_database_connection() -> bool:
    database_url = get_settings().database_url

    if database_url is None:
        return False

    try:
        async with asyncio.timeout(5):
            async with await AsyncConnection.connect(
                database_url.get_secret_value(),
                connect_timeout=5,
            ) as connection:
                await connection.execute("SELECT 1")
    except (PsycopgError, TimeoutError) as error:
        raise DatabaseConnectionError from error

    return True
