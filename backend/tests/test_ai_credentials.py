import unittest

from cryptography.fernet import Fernet

from app.services.ai_credentials import (
    AiCredentialEncryptionError,
    ApiKeyCipher,
    get_api_key_hint,
)


class ApiKeyCipherTests(unittest.TestCase):
    def setUp(self) -> None:
        encryption_key = Fernet.generate_key().decode("utf-8")
        self.cipher = ApiKeyCipher(encryption_key)

    def test_encrypts_and_decrypts_api_key(self) -> None:
        api_key = "test-gemini-api-key-1234"

        encrypted_api_key = self.cipher.encrypt(api_key)

        self.assertNotIn(api_key, encrypted_api_key)
        self.assertEqual(self.cipher.decrypt(encrypted_api_key), api_key)
        self.assertEqual(get_api_key_hint(api_key), "1234")

    def test_rejects_empty_api_key(self) -> None:
        with self.assertRaises(ValueError):
            self.cipher.encrypt("   ")

    def test_rejects_ciphertext_from_another_key(self) -> None:
        encrypted_api_key = self.cipher.encrypt("test-api-key")
        another_cipher = ApiKeyCipher(
            Fernet.generate_key().decode("utf-8"),
        )

        with self.assertRaises(AiCredentialEncryptionError):
            another_cipher.decrypt(encrypted_api_key)


if __name__ == "__main__":
    unittest.main()
