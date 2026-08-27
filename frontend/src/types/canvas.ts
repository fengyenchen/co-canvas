import type { Edge, Node } from '@xyflow/react'

export type ContentOrigin = 'user' | 'ai'
export type ConceptNodeColor =
    | 'default'
    | 'yellow'
    | 'pink'
    | 'blue'
    | 'green'
    | 'purple'

export type CommonCanvasNodeData = {
    title: string
    content: string
    origin: ContentOrigin
}

export type ConceptNodeData = CommonCanvasNodeData & {
    color?: ConceptNodeColor
    startTimeMs?: number
    endTimeMs?: number
}

export type VideoNodeData = CommonCanvasNodeData & {
    sourceType: 'url'
    source: string
    durationMs?: number
}

export type CanvasNodeData = ConceptNodeData | VideoNodeData

export type CanvasEdgeData = {
    label?: string
    origin: ContentOrigin
}

export type ConceptCanvasNode = Node<ConceptNodeData, 'concept'>
export type VideoCanvasNode = Node<VideoNodeData, 'video'>
export type CanvasNode = ConceptCanvasNode | VideoCanvasNode
export type CanvasEdge = Edge<CanvasEdgeData>
