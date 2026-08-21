import { z } from 'zod'
import type { ChatRole } from '../types/chat'
import { throwApiRequestError } from './errors'

type ContextNode = {
  id: string
  title: string
  content: string
}

type ChatHistoryMessage = {
  role: ChatRole
  content: string
}

type ChatInput = {
  prompt: string
  selectedNode: ContextNode
  neighborNodes: ContextNode[]
  history: ChatHistoryMessage[]
  projectId?: string
}

const chatResponseSchema = z.object({
  message: z.string(),
})

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function sendChatMessage(
  input: ChatInput,
): Promise<string> {
  const { projectId, ...requestBody } = input
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
  })

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return chatResponseSchema.parse(await response.json()).message
}
