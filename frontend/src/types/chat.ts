export type ChatRole = 'user' | 'ai'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  contextNodeId: string | null
  createdAt: string
  canGenerateNodes?: boolean
  latencyMs?: number
  isError?: boolean
  retryAction?: 'chat' | 'suggestion'
  retryContent?: string
}

export type NewChatMessage = Pick<
  ChatMessage,
  | 'role'
  | 'content'
  | 'contextNodeId'
  | 'canGenerateNodes'
  | 'latencyMs'
  | 'isError'
  | 'retryAction'
  | 'retryContent'
>
