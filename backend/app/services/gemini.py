import asyncio

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
from app.services.video_source import (
    VideoSourceError,
    download_video_file,
    get_supported_video_mime_type,
    get_video_source_error,
    normalize_downloadable_video_url,
    remove_temporary_video,
)


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


def build_chat_parts(
    request: ChatRequest,
    history: str,
    uploaded_video_part: types.Part | None = None,
) -> list[types.Part]:
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

    if uploaded_video_part is not None:
        parts.append(uploaded_video_part)
    elif has_video_clip and selected_node and linked_video:
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


async def upload_chat_video_clip(
    client,
    request: ChatRequest,
) -> tuple[types.Part | None, str | None]:
    selected_node = request.selected_node
    linked_video = selected_node.linked_video if selected_node else None

    if (
        not selected_node
        or selected_node.start_time_ms is None
        or selected_node.end_time_ms is None
        or not linked_video
        or not linked_video.source
    ):
        return None, None

    downloadable_url = normalize_downloadable_video_url(linked_video.source)
    if downloadable_url is None:
        source_error = get_video_source_error(
            linked_video.source,
            linked_video.provider,
        )
        if source_error:
            raise VideoSourceError(source_error)
        return None, None

    temporary_path = await download_video_file(linked_video.source)
    uploaded_file = None
    video_mime_type = (
        get_supported_video_mime_type(linked_video.source) or "video/mp4"
    )

    try:
        uploaded_file = await client.files.upload(
            file=temporary_path,
            config=types.UploadFileConfig(
                mime_type=video_mime_type,
                display_name=linked_video.title,
            ),
        )
    finally:
        remove_temporary_video(temporary_path)

    try:
        if not uploaded_file.name:
            raise VideoSourceError("Gemini 未回傳影片檔案識別碼")

        for _ in range(60):
            state_name = uploaded_file.state.name if uploaded_file.state else None
            if state_name == "ACTIVE":
                break
            if state_name == "FAILED":
                raise VideoSourceError("Gemini 無法處理這個影片檔案")
            await asyncio.sleep(2)
            uploaded_file = await client.files.get(name=uploaded_file.name)
        else:
            raise VideoSourceError("等待 Gemini 處理影片逾時")

        if not uploaded_file.uri:
            raise VideoSourceError("Gemini 未回傳影片檔案網址")

        return (
            types.Part(
                file_data=types.FileData(
                    file_uri=uploaded_file.uri,
                    mime_type=uploaded_file.mime_type or video_mime_type,
                ),
                video_metadata=types.VideoMetadata(
                    start_offset=f"{selected_node.start_time_ms / 1000}s",
                    end_offset=f"{selected_node.end_time_ms / 1000}s",
                ),
            ),
            uploaded_file.name,
        )
    except Exception:
        if uploaded_file and uploaded_file.name:
            await client.files.delete(name=uploaded_file.name)
        raise


async def chat_with_gemini(
    request: ChatRequest,
    api_key: str | None = None,
) -> ChatResponse:
    settings, resolved_api_key = load_settings(api_key)
    history = "\n".join(
        f"{'使用者' if message.role == 'user' else 'AI'}：{message.content}"
        for message in request.history
    ) or "（尚無先前對話）"

    uploaded_file_name: str | None = None

    async with genai.Client(
        api_key=resolved_api_key,
    ).aio as client:
        try:
            uploaded_video_part, uploaded_file_name = await upload_chat_video_clip(
                client,
                request,
            )
            response = await client.models.generate_content(
                model=settings.gemini_model,
                contents=types.Content(
                    parts=build_chat_parts(
                        request,
                        history,
                        uploaded_video_part,
                    )
                ),
                config=types.GenerateContentConfig(
                    system_instruction=CHAT_SYSTEM_INSTRUCTION,
                ),
            )
        finally:
            if uploaded_file_name:
                try:
                    await client.files.delete(name=uploaded_file_name)
                except Exception:
                    pass

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
