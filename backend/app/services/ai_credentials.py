from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.settings import get_settings


class AiCredentialConfigurationError(RuntimeError):
    pass


class AiCredentialEncryptionError(RuntimeError):
    pass


class ApiKeyCipher:
    def __init__(self, encryption_key: str) -> None:
        try:
            self._fernet = Fernet(encryption_key.encode("utf-8"))
        except (TypeError, ValueError) as error:
            raise AiCredentialConfigurationError(
                "AI_CREDENTIAL_ENCRYPTION_KEY 格式無效",
            ) from error

    def encrypt(self, api_key: str) -> str:
        normalized_key = api_key.strip()

        if not normalized_key:
            raise ValueError("Gemini API Key 不可為空")

        return self._fernet.encrypt(
            normalized_key.encode("utf-8"),
        ).decode("utf-8")

    def decrypt(self, encrypted_api_key: str) -> str:
        try:
            return self._fernet.decrypt(
                encrypted_api_key.encode("utf-8"),
            ).decode("utf-8")
        except (InvalidToken, UnicodeDecodeError) as error:
            raise AiCredentialEncryptionError(
                "無法解密 Gemini API Key",
            ) from error


def get_api_key_hint(api_key: str) -> str:
    normalized_key = api_key.strip()

    if not normalized_key:
        raise ValueError("Gemini API Key 不可為空")

    return normalized_key[-4:]


@lru_cache
def get_api_key_cipher() -> ApiKeyCipher:
    encryption_key = get_settings().ai_credential_encryption_key

    if encryption_key is None:
        raise AiCredentialConfigurationError(
            "AI_CREDENTIAL_ENCRYPTION_KEY 尚未設定",
        )

    return ApiKeyCipher(encryption_key.get_secret_value())
