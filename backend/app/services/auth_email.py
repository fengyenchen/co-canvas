from html import escape

import httpx

from app.settings import Settings


class WelcomeEmailError(RuntimeError):
    pass


async def send_welcome_email(
    email: str,
    name: str | None,
    user_hash: str,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> str:
    if settings.resend_api_key is None or not settings.resend_from_email:
        raise WelcomeEmailError("RESEND_API_KEY 或 RESEND_FROM_EMAIL 尚未設定")

    safe_name = escape(name.strip()) if name and name.strip() else "你好"
    project_url = escape(settings.app_public_url.rstrip("/") + "/projects")
    html = f"""
    <div style="margin:0;background:#f5f6f8;padding:32px 16px;font-family:Arial,'Noto Sans TC',sans-serif;color:#172033">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e6ec;border-radius:16px;padding:32px">
        <p style="margin:0 0 8px;font-size:14px;color:#667085">Co-Canvas</p>
        <h1 style="margin:0 0 20px;font-size:26px;line-height:1.35">歡迎加入 Co-Canvas</h1>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.75">{safe_name}，你的 Email 已成功驗證。</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.75;color:#475467">現在可以建立雲端專案、邀請成員，並使用節點與 AI 對話整理想法。</p>
        <a href="{project_url}" style="display:inline-block;background:#55545d;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:600">進入專案</a>
        <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#98a2b3">如果你沒有建立 Co-Canvas 帳號，可以忽略這封信。</p>
      </div>
    </div>
    """.strip()

    owns_client = client is None
    request_client = client or httpx.AsyncClient(timeout=15)
    try:
        response = await request_client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": (
                    f"Bearer {settings.resend_api_key.get_secret_value()}"
                ),
                "Idempotency-Key": f"co-canvas-welcome-{user_hash}",
            },
            json={
                "from": settings.resend_from_email,
                "to": [email],
                "subject": "歡迎加入 Co-Canvas",
                "html": html,
                "text": (
                    "歡迎加入 Co-Canvas！你的 Email 已成功驗證。"
                    f"進入專案：{settings.app_public_url.rstrip('/')}/projects"
                ),
            },
        )
    finally:
        if owns_client:
            await request_client.aclose()

    if not response.is_success:
        raise WelcomeEmailError(
            f"Resend 歡迎信寄送失敗（HTTP {response.status_code}）"
        )
    payload = response.json()
    message_id = payload.get("id") if isinstance(payload, dict) else None
    if not isinstance(message_id, str) or not message_id:
        raise WelcomeEmailError("Resend 歡迎信回應缺少郵件識別碼")
    return message_id
