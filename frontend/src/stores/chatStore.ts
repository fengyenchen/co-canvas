import { create } from 'zustand'

type ChatState = {
  activeContextNodeId: string | null

  setActiveContextNodeId: (
    nodeId: string | null,
  ) => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeContextNodeId: null,

  setActiveContextNodeId: (nodeId) =>
    set({
      activeContextNodeId: nodeId,
    }),
}))