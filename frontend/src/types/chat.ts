export type ChatRole = 'user' | 'ai'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  contextNodeId: string | null
  createdAt: string
  canGenerateNodes?: boolean
  latencyMs?: number
}

export type NewChatMessage = Pick<
  ChatMessage,
  | 'role'
  | 'content'
  | 'contextNodeId'
  | 'canGenerateNodes'
  | 'latencyMs'
>
