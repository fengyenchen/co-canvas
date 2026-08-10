import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, NewChatMessage } from '../types/chat'
import type { SuggestionPreview } from '../types/suggestion'

type ChatState = {
  activeContextNodeId: string | null
  messages: ChatMessage[]
  isGenerating: boolean
  pendingSuggestion: SuggestionPreview | null

  setActiveContextNodeId: (
    nodeId: string | null,
  ) => void

  addMessage: (message: NewChatMessage) => void

  setIsGenerating: (isGenerating: boolean) => void

  setPendingSuggestion: (
    preview: SuggestionPreview,
  ) => void

  clearPendingSuggestion: () => void
}

export const useChatStore = create<ChatState>()(
  persist((set) => ({
    activeContextNodeId: null,
    messages: [],
    isGenerating: false,
    pendingSuggestion: null,

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

    setPendingSuggestion: (preview) =>
      set({
        pendingSuggestion: preview,
      }),

    clearPendingSuggestion: () =>
      set({
        pendingSuggestion: null,
      }),
  }), {
    name: 'co-canvas-chat',
    version: 1,
    partialize: (state) => ({
      messages: state.messages,
    }),
  }),
)
