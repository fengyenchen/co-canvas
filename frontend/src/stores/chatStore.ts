import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, NewChatMessage } from '../types/chat'
import type { SuggestionPreview } from '../types/suggestion'

export type GenerationMode = 'chat' | 'suggestion'

type ChatState = {
  activeContextNodeId: string | null
  messages: ChatMessage[]
  generationMode: GenerationMode | null
  pendingSuggestion: SuggestionPreview | null

  setActiveContextNodeId: (
    nodeId: string | null,
  ) => void

  addMessage: (message: NewChatMessage) => void

  clearMessagesByContext: (contextNodeId: string) => void

  removeContexts: (contextNodeIds: string[]) => void

  deleteMessage: (messageId: string) => void

  updateMessage: (messageId: string, content: string) => void

  setGenerationMode: (
    generationMode: GenerationMode | null,
  ) => void

  setPendingSuggestion: (
    preview: SuggestionPreview,
  ) => void

  clearPendingSuggestion: () => void
}

export const useChatStore = create<ChatState>()(
  persist((set) => ({
    activeContextNodeId: null,
    messages: [],
    generationMode: null,
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

    clearMessagesByContext: (contextNodeId) =>
      set((state) => ({
        messages: state.messages.filter(
          (message) => message.contextNodeId !== contextNodeId,
        ),
        pendingSuggestion:
          state.pendingSuggestion?.contextNodeId === contextNodeId
            ? null
            : state.pendingSuggestion,
      })),

    removeContexts: (contextNodeIds) =>
      set((state) => {
        const removedIds = new Set(contextNodeIds)
        const removesActiveContext =
          state.activeContextNodeId !== null &&
          removedIds.has(state.activeContextNodeId)

        return {
          messages: state.messages.filter(
            (message) =>
              message.contextNodeId === null ||
              !removedIds.has(message.contextNodeId),
          ),
          activeContextNodeId: removesActiveContext
            ? null
            : state.activeContextNodeId,
          pendingSuggestion:
            state.pendingSuggestion?.contextNodeId &&
            removedIds.has(state.pendingSuggestion.contextNodeId)
              ? null
              : state.pendingSuggestion,
          generationMode: removesActiveContext
            ? null
            : state.generationMode,
        }
      }),

    deleteMessage: (messageId) =>
      set((state) => ({
        messages: state.messages.filter(
          (message) => message.id !== messageId,
        ),
      })),

    updateMessage: (messageId, content) =>
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === messageId
            ? { ...message, content }
            : message,
        ),
      })),

    setGenerationMode: (generationMode) =>
      set({
        generationMode,
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
      activeContextNodeId: state.activeContextNodeId,
      messages: state.messages,
    }),
  }),
)
