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
    const undo = useCanvasStore((state) => state.undo)
    const redo = useCanvasStore((state) => state.redo)
    const canUndo = useCanvasStore((state) => state.canUndo)
    const canRedo = useCanvasStore((state) => state.canRedo)

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
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
                <button
                    type="button"
                    onClick={addNode}
                    className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover"
                >
                    新增節點
                </button>

                <div className="flex overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={!canUndo}
                        aria-label="復原"
                        title="復原"
                        className="cursor-pointer border-r border-border px-3 py-2 text-sm text-foreground transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        ↶
                    </button>

                    <button
                        type="button"
                        onClick={redo}
                        disabled={!canRedo}
                        aria-label="重做"
                        title="重做"
                        className="cursor-pointer px-3 py-2 text-sm text-foreground transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        ↷
                    </button>
                </div>
            </div>

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
