import { useEffect, useRef } from 'react'
import {
    Background,
    Controls,
    ReactFlow,
    ReactFlowProvider,
    useNodesInitialized,
    useReactFlow,
} from '@xyflow/react'
import type { NodeTypes } from '@xyflow/react'
import { useCanvasStore } from '../../stores/canvasStore'
import { ConceptNode } from './ConceptNode'
import { NodeEditor } from './NodeEditor'

const nodeTypes: NodeTypes = {
    concept: ConceptNode,
}

function CanvasContent() {
    const nodes = useCanvasStore((state) => state.nodes)
    const nodesInitialized = useNodesInitialized()
    const { fitView } = useReactFlow()
    const previousNodeCount = useRef(nodes.length)

    const edges = useCanvasStore((state) => state.edges)
    const addNode = useCanvasStore((state) => state.addNode)
    const onNodesChange = useCanvasStore((state) => state.onNodesChange)
    const onEdgesChange = useCanvasStore((state) => state.onEdgesChange)
    const onConnect = useCanvasStore((state) => state.onConnect)

    useEffect(() => {
        if (!nodesInitialized) {
            return
        }

        const previousCount = previousNodeCount.current
        previousNodeCount.current = nodes.length

        if (nodes.length <= previousCount) {
            return
        }

        void fitView({
            padding: 0.2,
            duration: 300,
            maxZoom: 1.2,
        })
    }, [fitView, nodes.length, nodesInitialized])

    return (
        <section className="relative h-full min-w-0 flex-1 bg-canvas">
            <button
                type="button"
                onClick={addNode}
                className="absolute left-4 top-4 z-10 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover cursor-pointer"
            >
                新增節點
            </button>

            <NodeEditor />

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                className="bg-canvas"
                fitView
            >
                <Background />
                <Controls />
            </ReactFlow>
        </section>
    )
}

export function Canvas() {
    return (
        <ReactFlowProvider>
            <CanvasContent />
        </ReactFlowProvider>
    )
}
