import type { Edge, Node } from '@xyflow/react'

export type NodeSource = 'user' | 'ai'

export type CanvasNodeData = {
    title: string
    content: string
    source: NodeSource
}

export type CanvasEdgeData = {
    label?: string
    source: NodeSource
}

export type CanvasNode = Node<CanvasNodeData>
export type CanvasEdge = Edge<CanvasEdgeData>