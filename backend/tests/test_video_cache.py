from app.services.video_cache import (
    create_credential_fingerprint,
    create_video_source_hash,
)


def test_cache_fingerprints_are_stable_without_storing_secrets() -> None:
    fingerprint = create_credential_fingerprint("secret-api-key")

    assert fingerprint == create_credential_fingerprint("secret-api-key")
    assert fingerprint != create_credential_fingerprint("another-api-key")
    assert "secret-api-key" not in fingerprint


def test_video_source_hash_changes_with_source() -> None:
    assert create_video_source_hash("https://example.com/a.mp4") != (
        create_video_source_hash("https://example.com/b.mp4")
    )
