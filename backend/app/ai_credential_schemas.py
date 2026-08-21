from datetime import datetime
from typing import Literal

from pydantic import Field, SecretStr, field_validator

from app.schemas import ApiModel


AiProvider = Literal["gemini"]
AiCredentialStatus = Literal["unverified", "valid", "invalid"]


class AiCredentialUpsert(ApiModel):
    api_key: SecretStr = Field(min_length=1, max_length=512)

    @field_validator("api_key")
    @classmethod
    def reject_blank_api_key(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().strip():
            raise ValueError("Gemini API Key 不可為空")

        return value


class AiCredentialResponse(ApiModel):
    provider: AiProvider = "gemini"
    configured: bool
    key_hint: str | None = None
    status: AiCredentialStatus | None = None
    last_validated_at: datetime | None = None
    updated_at: datetime | None = None
