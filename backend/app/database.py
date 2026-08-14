import asyncio

from psycopg import AsyncConnection, Error as PsycopgError

from app.settings import get_settings


class DatabaseConnectionError(RuntimeError):
    pass


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
