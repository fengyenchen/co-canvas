export type ChatRole = 'user' | 'ai'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  contextNodeId: string | null
  createdAt: string
  canGenerateNodes?: boolean
}

export type NewChatMessage = Pick<
  ChatMessage,
  'role' | 'content' | 'contextNodeId' | 'canGenerateNodes'
>
