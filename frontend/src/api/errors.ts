import { z } from 'zod'

const errorResponseSchema = z.object({
  detail: z.string(),
})

export class ApiRequestError extends Error {
  readonly status: number
  readonly detail: string

  constructor(
    status: number,
    detail: string,
  ) {
    super(detail)
    this.name = 'ApiRequestError'
    this.status = status
    this.detail = detail
  }
}

export async function throwApiRequestError(
  response: Response,
): Promise<never> {
  const body = await response.json().catch(() => null)
  const parsedBody = errorResponseSchema.safeParse(body)

  throw new ApiRequestError(
    response.status,
    parsedBody.success ? parsedBody.data.detail : '伺服器發生錯誤',
  )
}

export function getAiErrorMessage(
  error: unknown,
  operation: 'chat' | 'suggestion',
): string {
  const retryHint = operation === 'chat'
    ? '請編輯上一則訊息後重新傳送。'
    : '請稍後再次點擊「產生節點」。'

  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.status === 503) {
      return `${error.detail}。請設定有效的 API Key，或由系統管理者切換為 Mock 模式。`
    }

    if (error.status === 429) {
      return `Gemini 額度不足或請求過多。${retryHint}`
    }

    if (error.status === 504) {
      return `Gemini 回應逾時。${retryHint}`
    }

    if (error.status === 502) {
      return `${error.detail}。${retryHint}`
    }

    return `${error.detail}。${retryHint}`
  }

  if (error instanceof TypeError) {
    return '無法連線後端，請確認服務已啟動後再試一次。'
  }

  return `AI 回傳資料格式無效。${retryHint}`
}
