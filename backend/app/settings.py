from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ai_mode: Literal["mock", "gemini"] = "gemini"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.6-flash"
    ai_credential_encryption_key: SecretStr | None = None
    database_url: SecretStr | None = None
    database_migration_url: SecretStr | None = None
    neon_auth_jwks_url: AnyHttpUrl | None = None
    cors_allowed_origins: str = "http://localhost:5173"
    api_rate_limit_requests: int = Field(default=120, ge=1)
    ai_rate_limit_requests: int = Field(default=20, ge=1)
    rate_limit_window_seconds: int = Field(default=60, ge=1)
    max_request_body_bytes: int = Field(default=2_000_000, ge=1)

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
