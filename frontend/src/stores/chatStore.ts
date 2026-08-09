import { create } from 'zustand'
import type { ChatMessage, NewChatMessage } from '../types/chat'

type ChatState = {
  activeContextNodeId: string | null

  setActiveContextNodeId: (
    nodeId: string | null,
  ) => void

  messages: ChatMessage[]

  addMessage: (message: NewChatMessage) => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeContextNodeId: null,
  messages: [],

  setActiveContextNodeId: (nodeId) =>
    set({
      activeContextNodeId: nodeId,
    }),

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        },
      ],
    })),
}))