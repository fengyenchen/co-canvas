import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, NewChatMessage } from '../types/chat'
import type {
  SuggestionDecision,
  SuggestionDecisionEvent,
  SuggestionPreview,
} from '../types/suggestion'

export type GenerationMode = 'chat' | 'suggestion'

type ChatState = {
  activeContextNodeId: string | null
  messages: ChatMessage[]
  generationMode: GenerationMode | null
  pendingSuggestion: SuggestionPreview | null
  suggestionEvents: SuggestionDecisionEvent[]

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

  updatePendingSuggestionNode: (
    tempId: string,
    updates: { title?: string; content?: string },
  ) => void

  recordSuggestionDecision: (action: SuggestionDecision) => void

  replaceProjectMessages: (
    messages: ChatMessage[],
    suggestionEvents?: SuggestionDecisionEvent[],
    preserveTransientState?: boolean,
  ) => void
}

export const useChatStore = create<ChatState>()(
  persist((set) => ({
    activeContextNodeId: null,
    messages: [],
    generationMode: null,
    pendingSuggestion: null,
    suggestionEvents: [],

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

    updatePendingSuggestionNode: (tempId, updates) =>
      set((state) => {
        if (!state.pendingSuggestion) return state

        return {
          pendingSuggestion: {
            ...state.pendingSuggestion,
            edited: true,
            suggestion: {
              ...state.pendingSuggestion.suggestion,
              nodes: state.pendingSuggestion.suggestion.nodes.map((node) =>
                node.tempId === tempId ? { ...node, ...updates } : node,
              ),
            },
          },
        }
      }),

    recordSuggestionDecision: (action) =>
      set((state) => {
        const preview = state.pendingSuggestion
        if (!preview) return state

        const previewedAt = Date.parse(preview.previewedAt)
        const decisionTimeMs = Number.isFinite(previewedAt)
          ? Math.max(0, Date.now() - previewedAt)
          : 0

        return {
          suggestionEvents: [
            ...state.suggestionEvents,
            {
              id: crypto.randomUUID(),
              action,
              contextNodeId: preview.contextNodeId,
              aiMode: preview.aiMode,
              edited: preview.edited,
              decisionTimeMs,
              nodeCount: preview.suggestion.nodes.length,
              createdAt: new Date().toISOString(),
            },
          ].slice(-5000),
        }
      }),

    replaceProjectMessages: (
      messages,
      suggestionEvents = [],
      preserveTransientState = false,
    ) =>
      set((state) => ({
        messages,
        suggestionEvents,
        activeContextNodeId: preserveTransientState
          ? state.activeContextNodeId
          : null,
        generationMode: preserveTransientState
          ? state.generationMode
          : null,
        pendingSuggestion: preserveTransientState
          ? state.pendingSuggestion
          : null,
      })),
  }), {
    name: 'co-canvas-chat',
    version: 1,
    partialize: (state) => ({
      activeContextNodeId: state.activeContextNodeId,
      messages: state.messages,
      suggestionEvents: state.suggestionEvents,
    }),
  }),
)
