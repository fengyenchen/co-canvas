import { create } from 'zustand'
import type { ChatMessage, NewChatMessage } from '../types/chat'

type ChatState = {
  activeContextNodeId: string | null
  messages: ChatMessage[]
  isGenerating: boolean

  setActiveContextNodeId: (
    nodeId: string | null,
  ) => void

  addMessage: (message: NewChatMessage) => void

  setIsGenerating: (isGenerating: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeContextNodeId: null,
  messages: [],
  isGenerating: false,

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

  setIsGenerating: (isGenerating) =>
    set({
      isGenerating,
    }),
}))