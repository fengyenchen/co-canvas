import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    type Connection,
    type EdgeChange,
    type NodeChange,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type {
    CanvasEdge,
    CanvasNode,
    CommonCanvasNodeData,
    ConceptNodeData,
    VideoNodeData,
} from '../types/canvas'
import type { SuggestionPreview } from '../types/suggestion'
import { useChatStore } from './chatStore'

const SUGGESTED_NODE_WIDTH = 256
const SUGGESTED_NODE_HEIGHT = 120
const VERTICAL_STEP = 180
const CONTEXT_GAP = 80
const COLUMN_STEP = 336
const COLLISION_PADDING = 40
const HISTORY_LIMIT = 50
const LAYOUT_NODE_GAP = 64
const LAYOUT_RANK_GAP = 96

type CanvasSnapshot = {
    nodes: CanvasNode[]
    edges: CanvasEdge[]
}

function createSnapshot(state: CanvasSnapshot): CanvasSnapshot {
    return {
        nodes: state.nodes,
        edges: state.edges,
    }
}

function addToHistory(
    past: CanvasSnapshot[],
    snapshot: CanvasSnapshot,
): CanvasSnapshot[] {
    return [...past, snapshot].slice(-HISTORY_LIMIT)
}

function getBranchNodeIds(
    rootNodeId: string,
    edges: CanvasEdge[],
): Set<string> {
    const nodeIds = new Set([rootNodeId])
    const pendingNodeIds = [rootNodeId]

    while (pendingNodeIds.length > 0) {
        const sourceNodeId = pendingNodeIds.pop()

        for (const edge of edges) {
            if (
                edge.source === sourceNodeId &&
                !nodeIds.has(edge.target)
            ) {
                nodeIds.add(edge.target)
                pendingNodeIds.push(edge.target)
            }
        }
    }

    return nodeIds
}

function clearOrphanedTimeRanges(
    nodes: CanvasNode[],
    edges: CanvasEdge[],
): CanvasNode[] {
    const videoNodeIds = new Set(
        nodes.filter((node) => node.type === 'video').map((node) => node.id),
    )
    const linkedConceptNodeIds = new Set(
        edges
            .filter((edge) => videoNodeIds.has(edge.source))
            .map((edge) => edge.target),
    )

    return nodes.map((node) => {
        if (
            node.type !== 'concept' ||
            linkedConceptNodeIds.has(node.id) ||
            (node.data.startTimeMs === undefined && node.data.endTimeMs === undefined)
        ) {
            return node
        }

        const { startTimeMs, endTimeMs, ...data } = node.data
        void startTimeMs
        void endTimeMs
        return { ...node, data }
    })
}

function layoutNodes(
    nodes: CanvasNode[],
    edges: CanvasEdge[],
): CanvasNode[] {
    const graph = new dagre.graphlib.Graph()

    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({
        rankdir: 'TB',
        nodesep: LAYOUT_NODE_GAP,
        ranksep: LAYOUT_RANK_GAP,
        marginx: 40,
        marginy: 40,
    })

    for (const node of nodes) {
        const width =
            node.measured?.width ??
            node.width ??
            SUGGESTED_NODE_WIDTH
        const height =
            node.measured?.height ??
            node.height ??
            SUGGESTED_NODE_HEIGHT

        graph.setNode(node.id, { width, height })
    }

    for (const edge of edges) {
        graph.setEdge(edge.source, edge.target)
    }

    dagre.layout(graph)

    return nodes.map((node) => {
        const layout = graph.node(node.id)
        const width =
            node.measured?.width ??
            node.width ??
            SUGGESTED_NODE_WIDTH
        const height =
            node.measured?.height ??
            node.height ??
            SUGGESTED_NODE_HEIGHT

        return {
            ...node,
            position: {
                x: layout.x - width / 2,
                y: layout.y - height / 2,
            },
        }
    })
}

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
    past: CanvasSnapshot[]
    future: CanvasSnapshot[]
    isNodeDragging: boolean
    canUndo: boolean
    canRedo: boolean
    videoSeekRequest: {
        videoNodeId: string
        timeMs: number
        requestId: string
    } | null

    addNode: () => void
    addVideoNode: () => string
    updateNode: (
        nodeId: string,
        updates: Partial<
            Pick<CommonCanvasNodeData, 'title' | 'content'>
        >,
    ) => void
    updateVideoNode: (
        nodeId: string,
        updates: Partial<Pick<VideoNodeData, 'source' | 'durationMs'>> &
            Partial<Pick<CommonCanvasNodeData, 'title' | 'content'>>,
    ) => void
    updateConceptTimeRange: (
        nodeId: string,
        timeRange: Pick<ConceptNodeData, 'startTimeMs' | 'endTimeMs'>,
    ) => void
    requestVideoSeek: (videoNodeId: string, timeMs: number) => void
    deleteNode: (nodeId: string) => void
    deleteBranch: (nodeId: string) => void
    updateEdgeLabel: (edgeId: string, label: string) => void
    deleteEdge: (edgeId: string) => void
    applySuggestion: (preview: SuggestionPreview) => void
    onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
    onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void
    onConnect: (connection: Connection) => void
    autoLayout: () => void
    undo: () => void
    redo: () => void
    replaceProject: (nodes: CanvasNode[], edges: CanvasEdge[]) => void
}

export const useCanvasStore = create<CanvasState>()(
    persist((set) => ({
    nodes: [],
    edges: [],
    past: [],
    future: [],
    isNodeDragging: false,
    canUndo: false,
    canRedo: false,
    videoSeekRequest: null,

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
                past: addToHistory(
                    state.past,
                    createSnapshot(state),
                ),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    addVideoNode: () => {
        const nodeId = crypto.randomUUID()

        set((state) => {
            const videoCount = state.nodes.filter(
                (node) => node.type === 'video',
            ).length
            const newNode: CanvasNode = {
                id: nodeId,
                type: 'video',
                position: {
                    x: 100 + videoCount * 320,
                    y: 100,
                },
                selected: true,
                data: {
                    title: `新影片 ${videoCount + 1}`,
                    content: '',
                    origin: 'user',
                    sourceType: 'url',
                    source: '',
                },
            }

            return {
                nodes: [
                    ...state.nodes.map((node) => ({
                        ...node,
                        selected: false,
                    })),
                    newNode,
                ],
                past: addToHistory(state.past, createSnapshot(state)),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        })

        return nodeId
    },

    updateNode: (nodeId, updates) =>
        set((state) => ({
            nodes: state.nodes.map((node) => {
                if (node.id !== nodeId) return node

                if (node.type === 'concept') {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...updates,
                        },
                    }
                }

                return {
                    ...node,
                    data: { ...node.data, ...updates },
                }
            }),
            past: addToHistory(
                state.past,
                createSnapshot(state),
            ),
            future: [],
            canUndo: true,
            canRedo: false,
        })),

    updateVideoNode: (nodeId, updates) =>
        set((state) => {
            const node = state.nodes.find(
                (candidate) => candidate.id === nodeId,
            )

            if (!node || node.type !== 'video') return state

            return {
                nodes: state.nodes.map((candidate) =>
                    candidate.id === nodeId && candidate.type === 'video'
                        ? { ...candidate, data: { ...candidate.data, ...updates } }
                        : candidate,
                ),
                past: addToHistory(state.past, createSnapshot(state)),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    updateConceptTimeRange: (nodeId, timeRange) =>
        set((state) => {
            const node = state.nodes.find(
                (candidate) => candidate.id === nodeId,
            )

            if (!node || node.type !== 'concept') return state

            return {
                nodes: state.nodes.map((candidate) =>
                    candidate.id === nodeId && candidate.type === 'concept'
                        ? {
                            ...candidate,
                            data: { ...candidate.data, ...timeRange },
                        }
                        : candidate,
                ),
                past: addToHistory(state.past, createSnapshot(state)),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    requestVideoSeek: (videoNodeId, timeMs) =>
        set((state) => ({
            nodes: state.nodes.map((node) => ({
                ...node,
                selected: node.id === videoNodeId,
            })),
            edges: state.edges.map((edge) => ({ ...edge, selected: false })),
            videoSeekRequest: {
                videoNodeId,
                timeMs,
                requestId: crypto.randomUUID(),
            },
        })),

    deleteNode: (nodeId) =>
        set((state) => {
            const hasNode = state.nodes.some(
                (node) => node.id === nodeId,
            )

            if (!hasNode) {
                return state
            }

            useChatStore.getState().removeContexts([nodeId])

            const remainingNodes = state.nodes.filter((node) => node.id !== nodeId)
            const remainingEdges = state.edges.filter(
                (edge) => edge.source !== nodeId && edge.target !== nodeId,
            )

            return {
                nodes: clearOrphanedTimeRanges(remainingNodes, remainingEdges),
                edges: remainingEdges,
                past: addToHistory(
                    state.past,
                    createSnapshot(state),
                ),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    deleteBranch: (nodeId) =>
        set((state) => {
            const hasNode = state.nodes.some(
                (node) => node.id === nodeId,
            )

            if (!hasNode) {
                return state
            }

            const branchNodeIds = getBranchNodeIds(
                nodeId,
                state.edges,
            )

            useChatStore
                .getState()
                .removeContexts([...branchNodeIds])

            const remainingNodes = state.nodes.filter(
                (node) => !branchNodeIds.has(node.id),
            )
            const remainingEdges = state.edges.filter(
                (edge) =>
                    !branchNodeIds.has(edge.source) &&
                    !branchNodeIds.has(edge.target),
            )

            return {
                nodes: clearOrphanedTimeRanges(remainingNodes, remainingEdges),
                edges: remainingEdges,
                past: addToHistory(
                    state.past,
                    createSnapshot(state),
                ),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    updateEdgeLabel: (edgeId, label) =>
        set((state) => {
            const edge = state.edges.find(
                (candidate) => candidate.id === edgeId,
            )

            if (!edge || edge.label === label) {
                return state
            }

            return {
                edges: state.edges.map((candidate) =>
                    candidate.id === edgeId
                        ? {
                            ...candidate,
                            label,
                            data: {
                                ...candidate.data,
                                origin:
                                    candidate.data?.origin ?? 'user',
                                label,
                            },
                        }
                        : candidate,
                ),
                past: addToHistory(
                    state.past,
                    createSnapshot(state),
                ),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    deleteEdge: (edgeId) =>
        set((state) => {
            const hasEdge = state.edges.some(
                (edge) => edge.id === edgeId,
            )

            if (!hasEdge) {
                return state
            }

            const remainingEdges = state.edges.filter(
                (edge) => edge.id !== edgeId,
            )

            return {
                nodes: clearOrphanedTimeRanges(state.nodes, remainingEdges),
                edges: remainingEdges,
                past: addToHistory(
                    state.past,
                    createSnapshot(state),
                ),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

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
                past: addToHistory(
                    state.past,
                    createSnapshot(state),
                ),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    onNodesChange: (changes) =>
        set((state) => {
            const removedNodeIds = changes.flatMap((change) =>
                change.type === 'remove' ? [change.id] : [],
            )

            if (removedNodeIds.length > 0) {
                useChatStore
                    .getState()
                    .removeContexts(removedNodeIds)
            }

            const startsDragging = changes.some(
                (change) =>
                    change.type === 'position' &&
                    change.dragging === true,
            ) && !state.isNodeDragging
            const stopsDragging = changes.some(
                (change) =>
                    change.type === 'position' &&
                    change.dragging === false,
            )
            const removesNode = changes.some(
                (change) => change.type === 'remove',
            )
            const shouldSaveHistory = startsDragging || removesNode

            const changedNodes = applyNodeChanges(changes, state.nodes)
            const changedNodeIds = new Set(changedNodes.map((node) => node.id))
            const remainingEdges = state.edges.filter(
                (edge) => changedNodeIds.has(edge.source) && changedNodeIds.has(edge.target),
            )

            return {
                nodes: clearOrphanedTimeRanges(changedNodes, remainingEdges),
                edges: remainingEdges,
                isNodeDragging: stopsDragging
                    ? false
                    : state.isNodeDragging || startsDragging,
                ...(shouldSaveHistory
                    ? {
                        past: addToHistory(
                            state.past,
                            createSnapshot(state),
                        ),
                        future: [],
                        canUndo: true,
                        canRedo: false,
                    }
                    : {}),
            }
        }),

    onEdgesChange: (changes) =>
        set((state) => {
            const removesEdge = changes.some(
                (change) => change.type === 'remove',
            )

            const changedEdges = applyEdgeChanges(changes, state.edges)

            return {
                nodes: removesEdge
                    ? clearOrphanedTimeRanges(state.nodes, changedEdges)
                    : state.nodes,
                edges: changedEdges,
                ...(removesEdge
                    ? {
                        past: addToHistory(
                            state.past,
                            createSnapshot(state),
                        ),
                        future: [],
                        canUndo: true,
                        canRedo: false,
                    }
                    : {}),
            }
        }),

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
            past: addToHistory(
                state.past,
                createSnapshot(state),
            ),
            future: [],
            canUndo: true,
            canRedo: false,
        })),

    autoLayout: () =>
        set((state) => {
            if (state.nodes.length < 2) {
                return state
            }

            return {
                nodes: layoutNodes(state.nodes, state.edges),
                past: addToHistory(
                    state.past,
                    createSnapshot(state),
                ),
                future: [],
                canUndo: true,
                canRedo: false,
            }
        }),

    undo: () =>
        set((state) => {
            const previous = state.past.at(-1)

            if (!previous) {
                return state
            }

            const past = state.past.slice(0, -1)

            return {
                ...previous,
                past,
                future: [
                    createSnapshot(state),
                    ...state.future,
                ],
                isNodeDragging: false,
                canUndo: past.length > 0,
                canRedo: true,
            }
        }),

    redo: () =>
        set((state) => {
            const [next, ...future] = state.future

            if (!next) {
                return state
            }

            const past = addToHistory(
                state.past,
                createSnapshot(state),
            )

            return {
                ...next,
                past,
                future,
                isNodeDragging: false,
                canUndo: true,
                canRedo: future.length > 0,
            }
        }),

    replaceProject: (nodes, edges) =>
        set({
            nodes,
            edges,
            past: [],
            future: [],
            isNodeDragging: false,
            canUndo: false,
            canRedo: false,
        }),
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
