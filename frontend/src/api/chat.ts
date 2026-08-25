import { z } from 'zod'
import type { AiFallbackReason, AiMode } from '../types/ai'
import type { AiContextNode } from '../types/aiContext'
import type { ChatRole } from '../types/chat'
import { throwApiRequestError } from './errors'

type ChatHistoryMessage = {
  role: ChatRole
  content: string
}

type ChatInput = {
  prompt: string
  selectedNode: AiContextNode
  neighborNodes: AiContextNode[]
  history: ChatHistoryMessage[]
  projectId?: string
  signal?: AbortSignal
}

const chatResponseSchema = z.object({
  message: z.string(),
  aiMode: z.enum(['gemini', 'mock']),
  fallbackReason: z.enum([
    'configured_mock',
    'unauthenticated',
    'missing_key',
    'invalid_key',
    'quota_exceeded',
  ]).nullable(),
})

export type ChatResult = {
  message: string
  aiMode: AiMode
  fallbackReason: AiFallbackReason | null
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function sendChatMessage(
  input: ChatInput,
): Promise<ChatResult> {
  const { projectId, signal, ...requestBody } = input
  const requestUrl = new URL(`${API_BASE_URL}/api/chat`)
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (projectId && projectId !== 'local') {
    requestUrl.searchParams.set('projectId', projectId)
    const { getAuthToken } = await import('../lib/auth')
    const token = await getAuthToken()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
    signal,
  })

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return chatResponseSchema.parse(await response.json())
}
