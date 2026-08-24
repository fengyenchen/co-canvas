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
- nodeType、時間區間與 linkedVideo 都是使用者人工建立的畫布脈絡。
- 不得聲稱已觀看、聽取或分析影片，也不得推測上下文未提供的影片內容。
""".strip()

CHAT_SYSTEM_INSTRUCTION = """
你是 Co-Canvas 的對話協作助手。
以自然、清楚且有幫助的文字回應使用者，協助釐清、延伸與整理想法。
畫布節點只作為對話上下文，不要假裝已經修改畫布，也不要主動輸出 JSON。
若資訊不足，可以提出一個簡短且具體的追問。
nodeType、時間區間與 linkedVideo 都是使用者人工建立的畫布脈絡。
若本次訊息附有影片片段，可以直接觀看與聽取該片段後回答。
若未附影片片段，不得聲稱已觀看、聽取或分析影片，也不得推測未提供的影片內容。
""".strip()

class GeminiConfigurationError(RuntimeError):
    pass


async def validate_gemini_api_key(api_key: str) -> None:
    settings, resolved_api_key = load_settings(api_key)

    async with genai.Client(api_key=resolved_api_key).aio as client:
        await client.models.generate_content(
            model=settings.gemini_model,
            contents="請只回覆 OK",
            config=types.GenerateContentConfig(
                max_output_tokens=2,
                temperature=0,
            ),
        )


def load_settings(api_key: str | None = None):
    try:
        settings = get_settings()
    except ValidationError as error:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is not configured"
        ) from error

    resolved_api_key = api_key

    if resolved_api_key is None and settings.gemini_api_key is not None:
        resolved_api_key = settings.gemini_api_key.get_secret_value()

    if resolved_api_key is None:
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is not configured"
        )

    return settings, resolved_api_key


def build_chat_parts(request: ChatRequest, history: str) -> list[types.Part]:
    selected_node = request.selected_node
    linked_video = selected_node.linked_video if selected_node else None
    has_video_clip = bool(
        selected_node
        and selected_node.start_time_ms is not None
        and selected_node.end_time_ms is not None
        and linked_video
        and linked_video.source
        and (
            "youtube.com/" in linked_video.source.lower()
            or "youtu.be/" in linked_video.source.lower()
        )
    )
    parts: list[types.Part] = []

    if has_video_clip and selected_node and linked_video:
        parts.append(
            types.Part(
                file_data=types.FileData(file_uri=linked_video.source),
                video_metadata=types.VideoMetadata(
                    start_offset=f"{selected_node.start_time_ms / 1000}s",
                    end_offset=f"{selected_node.end_time_ms / 1000}s",
                ),
            )
        )

    parts.append(
        types.Part(
            text=(
                "畫布上下文：\n"
                f"{request.model_dump_json(by_alias=True, exclude={'history', 'prompt'})}\n\n"
                "先前對話：\n"
                f"{history}\n\n"
                "使用者目前訊息：\n"
                f"{request.prompt}"
            ),
        )
    )
    return parts


async def chat_with_gemini(
    request: ChatRequest,
    api_key: str | None = None,
) -> ChatResponse:
    settings, resolved_api_key = load_settings(api_key)
    history = "\n".join(
        f"{'使用者' if message.role == 'user' else 'AI'}：{message.content}"
        for message in request.history
    ) or "（尚無先前對話）"

    async with genai.Client(
        api_key=resolved_api_key,
    ).aio as client:
        response = await client.models.generate_content(
            model=settings.gemini_model,
            contents=types.Content(parts=build_chat_parts(request, history)),
            config=types.GenerateContentConfig(
                system_instruction=CHAT_SYSTEM_INSTRUCTION,
            ),
        )

    if not response.text:
        raise RuntimeError("Gemini did not return a chat response")

    return ChatResponse(message=response.text.strip())


async def generate_with_gemini(
    request: GenerateSuggestionRequest,
    api_key: str | None = None,
) -> GenerateSuggestionResponse:
    settings, resolved_api_key = load_settings(api_key)

    async with genai.Client(
        api_key=resolved_api_key,
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
