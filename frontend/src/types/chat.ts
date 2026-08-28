export type ChatRole = 'user' | 'ai'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  contextNodeId: string | null
  createdAt: string
  authorId?: string
  authorEmail?: string
  authorName?: string
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
  | 'authorId'
  | 'authorEmail'
  | 'authorName'
  | 'canGenerateNodes'
  | 'latencyMs'
  | 'isError'
  | 'retryAction'
  | 'retryContent'
>
