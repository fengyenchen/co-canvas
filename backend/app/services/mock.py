from app.schemas import (
    ChatRequest,
    ChatResponse,
    GenerateSuggestionRequest,
    GenerateSuggestionResponse,
    SuggestedNode,
    SuggestedRelation,
)


def chat_with_mock(request: ChatRequest) -> ChatResponse:
    context_title = (
        request.selected_node.title
        if request.selected_node
        else "目前主題"
    )

    return ChatResponse(
        message=(
            "【Mock 模式】這是測試用回覆，未呼叫 Gemini。\n\n"
            f"你正在延伸「{context_title}」，問題是：「{request.prompt}」。"
            "可以先整理目標、下一步與可能風險，再選擇需要轉成節點的內容。"
        )
    )


def generate_with_mock(
    request: GenerateSuggestionRequest,
) -> GenerateSuggestionResponse:
    topic = (
        request.selected_node.title
        if request.selected_node
        else request.prompt[:24]
    )

    return GenerateSuggestionResponse(
        nodes=[
            SuggestedNode(
                temp_id="mock-goal",
                title=f"{topic}的目標",
                content="釐清希望達成的具體成果與判斷標準。",
            ),
            SuggestedNode(
                temp_id="mock-action",
                title="下一步行動",
                content="列出可立即執行的小步驟與負責項目。",
            ),
            SuggestedNode(
                temp_id="mock-risk",
                title="風險與限制",
                content="記錄可能阻礙進度的因素與因應方式。",
            ),
        ],
        relations=[
            SuggestedRelation(
                source_temp_id="mock-goal",
                target_temp_id="mock-action",
                label="引導",
            ),
            SuggestedRelation(
                source_temp_id="mock-action",
                target_temp_id="mock-risk",
                label="需考量",
            ),
        ],
    )
