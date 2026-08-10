from google import genai
from google.genai import types
from pydantic import ValidationError

from app.schemas import (
    ChatRequest,
    ChatResponse,
    GenerateSuggestionRequest,
    GenerateSuggestionResponse,
)
from app.settings import get_settings


SYSTEM_INSTRUCTION = """
你是 Co-Canvas 的內容結構助手。
根據使用者指令、選取節點與相鄰節點，產生簡潔且可操作的新節點建議。

規則：
- 只產生新的節點內容與新節點之間的語意關係。
- tempId 只能是本次回覆內使用的暫時識別碼。
- 不得使用或猜測正式節點 ID。
- 不得決定畫布座標。
- 不得刪除或修改使用者既有資料。
- 關係只能引用本次回覆中存在的 tempId。
- 避免重複既有節點的內容。
""".strip()

CHAT_SYSTEM_INSTRUCTION = """
你是 Co-Canvas 的對話協作助手。
以自然、清楚且有幫助的文字回應使用者，協助釐清、延伸與整理想法。
畫布節點只作為對話上下文，不要假裝已經修改畫布，也不要主動輸出 JSON。
若資訊不足，可以提出一個簡短且具體的追問。
""".strip()


class GeminiConfigurationError(RuntimeError):
    pass


def load_settings():
    try:
        return get_settings()
    except ValidationError as error:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is not configured"
        ) from error


async def chat_with_gemini(request: ChatRequest) -> ChatResponse:
    settings = load_settings()
    history = "\n".join(
        f"{'使用者' if message.role == 'user' else 'AI'}：{message.content}"
        for message in request.history
    ) or "（尚無先前對話）"

    async with genai.Client(
        api_key=settings.gemini_api_key.get_secret_value(),
    ).aio as client:
        response = await client.models.generate_content(
            model=settings.gemini_model,
            contents=(
                "畫布上下文：\n"
                f"{request.model_dump_json(by_alias=True, exclude={'history', 'prompt'})}\n\n"
                "先前對話：\n"
                f"{history}\n\n"
                "使用者目前訊息：\n"
                f"{request.prompt}"
            ),
            config=types.GenerateContentConfig(
                system_instruction=CHAT_SYSTEM_INSTRUCTION,
            ),
        )

    if not response.text:
        raise RuntimeError("Gemini did not return a chat response")

    return ChatResponse(message=response.text.strip())


async def generate_with_gemini(
    request: GenerateSuggestionRequest,
) -> GenerateSuggestionResponse:
    settings = load_settings()

    async with genai.Client(
        api_key=settings.gemini_api_key.get_secret_value(),
    ).aio as client:
        response = await client.models.generate_content(
            model=settings.gemini_model,
            contents=(
                "請根據以下畫布上下文產生節點建議：\n"
                f"{request.model_dump_json(by_alias=True)}"
            ),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=GenerateSuggestionResponse,
            ),
        )

    if isinstance(response.parsed, GenerateSuggestionResponse):
        return response.parsed

    if response.parsed is not None:
        return GenerateSuggestionResponse.model_validate(response.parsed)

    if not response.text:
        raise RuntimeError("Gemini did not return structured content")

    return GenerateSuggestionResponse.model_validate_json(response.text)
