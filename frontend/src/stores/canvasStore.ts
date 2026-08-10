import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    type Connection,
    type EdgeChange,
    type NodeChange,
} from '@xyflow/react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { CanvasEdge, CanvasNode, CanvasNodeData } from '../types/canvas'
import type { SuggestionPreview } from '../types/suggestion'

const SUGGESTED_NODE_WIDTH = 256
const SUGGESTED_NODE_HEIGHT = 120
const VERTICAL_STEP = 180
const CONTEXT_GAP = 80
const COLUMN_STEP = 336
const COLLISION_PADDING = 40

type NodeRect = {
    left: number
    top: number
    right: number
    bottom: number
}

function getNodeRect(node: CanvasNode): NodeRect {
    const width =
        node.measured?.width ?? node.width ?? SUGGESTED_NODE_WIDTH
    const height =
        node.measured?.height ?? node.height ?? SUGGESTED_NODE_HEIGHT

    return {
        left: node.position.x,
        top: node.position.y,
        right: node.position.x + width,
        bottom: node.position.y + height,
    }
}

function rectsOverlap(a: NodeRect, b: NodeRect): boolean {
    return (
        a.left < b.right + COLLISION_PADDING &&
        a.right > b.left - COLLISION_PADDING &&
        a.top < b.bottom + COLLISION_PADDING &&
        a.bottom > b.top - COLLISION_PADDING
    )
}

function findAvailableStartX(
    nodes: CanvasNode[],
    baseX: number,
    startY: number,
    suggestedNodeCount: number,
): number {
    if (suggestedNodeCount === 0) {
        return baseX
    }

    const groupHeight =
        (suggestedNodeCount - 1) * VERTICAL_STEP +
        SUGGESTED_NODE_HEIGHT
    const occupiedRects = nodes.map(getNodeRect)
    const maxAttempts = nodes.length + 10

    for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
        const candidateX = baseX + attempt * COLUMN_STEP
        const candidateRect: NodeRect = {
            left: candidateX,
            top: startY,
            right: candidateX + SUGGESTED_NODE_WIDTH,
            bottom: startY + groupHeight,
        }

        const hasCollision = occupiedRects.some((occupiedRect) =>
            rectsOverlap(candidateRect, occupiedRect),
        )

        if (!hasCollision) {
            return candidateX
        }
    }

    return baseX + (maxAttempts + 1) * COLUMN_STEP
}

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

export const useCanvasStore = create<CanvasState>()(
    persist((set) => ({
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

            const baseX = contextNode?.position.x ?? 100
            const startY = contextNode
                ? getNodeRect(contextNode).bottom + CONTEXT_GAP
                : 100
            const startX = findAvailableStartX(
                state.nodes,
                baseX,
                startY,
                nodeEntries.length,
            )

            const newNodes: CanvasNode[] = nodeEntries.map(
                ({ suggestedNode, id }, index) => ({
                    id,
                    type: 'concept',
                    position: {
                        x: startX,
                        y: startY + index * VERTICAL_STEP,
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
    }), {
        name: 'co-canvas-canvas',
        version: 1,
        partialize: (state) => ({
            nodes: state.nodes.map((node) => ({
                ...node,
                selected: false,
                dragging: false,
                measured: undefined,
                width: undefined,
                height: undefined,
            })),
            edges: state.edges.map((edge) => ({
                ...edge,
                selected: false,
            })),
        }),
    }),
)
