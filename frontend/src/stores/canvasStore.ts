import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    type Connection,
    type EdgeChange,
    type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'

import type { CanvasEdge, CanvasNode } from '../types/canvas'

type CanvasState = {
    nodes: CanvasNode[]
    edges: CanvasEdge[]

    addNode: () => void
    onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
    onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void
    onConnect: (connection: Connection) => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
    nodes: [],
    edges: [],

    addNode: () =>
        set((state) => {
            const newNode: CanvasNode = {
                id: crypto.randomUUID(),
                type: 'concept',
                position: {
                    x: 100 + state.nodes.length * 40,
                    y: 100 + state.nodes.length * 40,
                },
                data: {
                    title: `新節點 ${state.nodes.length + 1}`,
                    content: '',
                    source: 'user',
                },
            }

            return {
                nodes: [...state.nodes, newNode],
            }
        }),

    onNodesChange: (changes) =>
        set((state) => ({
            nodes: applyNodeChanges(changes, state.nodes),
        })),

    onEdgesChange: (changes) =>
        set((state) => ({
            edges: applyEdgeChanges(changes, state.edges),
        })),

    onConnect: (connection) =>
        set((state) => ({
            edges: addEdge(
                {
                    ...connection,
                    id: crypto.randomUUID(),
                    data: {
                        source: 'user',
                    },
                },
                state.edges,
            ),
        })),
}))