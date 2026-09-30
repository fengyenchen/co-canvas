from types import SimpleNamespace

import pytest

import app.main as main_module


@pytest.mark.anyio
async def test_uses_mock_after_all_gemini_models_exhaust_quota(monkeypatch) -> None:
    class FakeApiError(Exception):
        def __init__(self, code: int):
            self.code = code

    async def exhausted_operation():
        raise FakeApiError(429)

    mock_response = SimpleNamespace(message="mock fallback")
    monkeypatch.setattr(main_module, "APIError", FakeApiError)

    response, fallback_reason = await main_module.run_gemini(
        exhausted_operation(),
        fallback=lambda: mock_response,
    )

    assert response is mock_response
    assert fallback_reason == "quota_exceeded"


@pytest.mark.anyio
async def test_uses_mock_after_gemini_key_is_rejected(monkeypatch) -> None:
    class FakeApiError(Exception):
        def __init__(self, code: int):
            self.code = code

    async def rejected_operation():
        raise FakeApiError(401)

    mock_response = SimpleNamespace(message="mock fallback")
    monkeypatch.setattr(main_module, "APIError", FakeApiError)

    response, fallback_reason = await main_module.run_gemini(
        rejected_operation(),
        fallback=lambda: mock_response,
    )

    assert response is mock_response
    assert fallback_reason == "invalid_key"
