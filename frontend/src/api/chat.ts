import { z } from 'zod'
import type { ChatRole } from '../types/chat'

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
}

const chatResponseSchema = z.object({
  message: z.string(),
})

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function sendChatMessage(
  input: ChatInput,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return chatResponseSchema.parse(await response.json()).message
}
