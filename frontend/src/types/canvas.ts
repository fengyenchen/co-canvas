import type { Edge, Node } from '@xyflow/react'

export type ContentOrigin = 'user' | 'ai'

export type CanvasNodeData = {
    title: string
    content: string
    origin: ContentOrigin
    startTimeMs?: number
    endTimeMs?: number
}

export type CanvasEdgeData = {
    label?: string
    origin: ContentOrigin
}

export type CanvasNode = Node<CanvasNodeData>
export type CanvasEdge = Edge<CanvasEdgeData>
