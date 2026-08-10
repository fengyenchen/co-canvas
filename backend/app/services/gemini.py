from google import genai
from google.genai import types
from pydantic import ValidationError

from app.schemas import GenerateSuggestionRequest, GenerateSuggestionResponse
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


class GeminiConfigurationError(RuntimeError):
    pass


async def generate_with_gemini(
    request: GenerateSuggestionRequest,
) -> GenerateSuggestionResponse:
    try:
        settings = get_settings()
    except ValidationError as error:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is not configured"
        ) from error

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
