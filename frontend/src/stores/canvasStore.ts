import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    type Connection,
    type EdgeChange,
    type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'

import type { CanvasEdge, CanvasNode, CanvasNodeData } from '../types/canvas'
import type { SuggestionPreview } from '../types/suggestion'

type CanvasState = {
    nodes: CanvasNode[]
    edges: CanvasEdge[]

    addNode: () => void
    updateNode: (
        nodeId: string,
        updates: Partial<
            Pick<CanvasNodeData, 'title' | 'content'>
        >,
    ) => void
    applySuggestion: (preview: SuggestionPreview) => void
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
                    origin: 'user',
                },
            }

            return {
                nodes: [...state.nodes, newNode],
            }
        }),

    updateNode: (nodeId, updates) =>
        set((state) => ({
            nodes: state.nodes.map((node) =>
                node.id === nodeId ?
                    {
                        ...node,
                        data: {
                            ...node.data,
                            ...updates,
                        },
                    }
                    : node,
            ),
        })),

    applySuggestion: (preview) =>
        set((state) => {
            const { contextNodeId, suggestion } = preview

            const contextNode = contextNodeId
                ? state.nodes.find((node) => node.id === contextNodeId)
                : null

            if (contextNodeId && !contextNode) {
                return state
            }

            const nodeEntries = suggestion.nodes.map(
                (suggestedNode) => ({
                    suggestedNode,
                    id: crypto.randomUUID(),
                }),
            )

            const idByTempId = new Map(
                nodeEntries.map(({ suggestedNode, id }) => [
                    suggestedNode.tempId,
                    id,
                ]),
            )

            const startX = contextNode?.position.x ?? 100
            const startY = contextNode
                ? contextNode.position.y + 180
                : 100

            const newNodes: CanvasNode[] = nodeEntries.map(
                ({ suggestedNode, id }, index) => ({
                    id,
                    type: 'concept',
                    position: {
                        x: startX,
                        y: startY + index * 180,
                    },
                    data: {
                        title: suggestedNode.title,
                        content: suggestedNode.content,
                        origin: 'ai',
                    },
                }),
            )

            const relationEdges: CanvasEdge[] =
                suggestion.relations.flatMap((relation) => {
                    const source = idByTempId.get(
                        relation.sourceTempId,
                    )
                    const target = idByTempId.get(
                        relation.targetTempId,
                    )

                    if (!source || !target) {
                        return []
                    }

                    return [
                        {
                            id: crypto.randomUUID(),
                            source,
                            target,
                            label: relation.label,
                            data: {
                                origin: 'ai',
                                label: relation.label,
                            },
                        },
                    ]
                })

            const relationTargets = new Set(
                suggestion.relations.map(
                    (relation) => relation.targetTempId,
                ),
            )

            const rootSuggestedNodes = suggestion.nodes.filter(
                (node) => !relationTargets.has(node.tempId),
            )

            const contextEdges: CanvasEdge[] = contextNode
                ? rootSuggestedNodes.flatMap((node) => {
                    const target = idByTempId.get(node.tempId)

                    if (!target) {
                        return []
                    }

                    return [
                        {
                            id: crypto.randomUUID(),
                            source: contextNode.id,
                            target,
                            label: '延伸',
                            data: {
                                origin: 'ai',
                                label: '延伸',
                            },
                        },
                    ]
                })
                : []

            return {
                nodes: [...state.nodes, ...newNodes],
                edges: [
                    ...state.edges,
                    ...contextEdges,
                    ...relationEdges,
                ],
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
                        origin: 'user',
                    },
                },
                state.edges,
            ),
        })),
}))
