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
import { EdgeEditor } from './EdgeEditor'
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
    const autoLayout = useCanvasStore((state) => state.autoLayout)
    const canUndo = useCanvasStore((state) => state.canUndo)
    const canRedo = useCanvasStore((state) => state.canRedo)

    function handleAutoLayout() {
        autoLayout()

        window.requestAnimationFrame(() => {
            void fitView({
                padding: 0.2,
                duration: 300,
                maxZoom: 1.2,
            })
        })
    }

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

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            const target = event.target

            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                (target instanceof HTMLElement && target.isContentEditable)
            ) {
                return
            }

            if (!(event.ctrlKey || event.metaKey)) {
                return
            }

            const key = event.key.toLowerCase()

            if (key === 'z' && event.shiftKey) {
                event.preventDefault()
                redo()
                return
            }

            if (key === 'z') {
                event.preventDefault()
                undo()
                return
            }

            if (key === 'y') {
                event.preventDefault()
                redo()
            }
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [redo, undo])

    return (
        <section className="relative h-full min-w-0 flex-1 bg-canvas">
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
                <button
                    type="button"
                    onClick={addNode}
                    className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    新增節點
                </button>

                <button
                    type="button"
                    onClick={handleAutoLayout}
                    disabled={nodes.length < 2}
                    className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35"
                >
                    自動排版
                </button>

                <div className="flex min-h-11 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                    <button
                        type="button"
                        onClick={undo}
                        disabled={!canUndo}
                        aria-label="復原"
                        title="復原（Ctrl+Z）"
                        className="min-w-11 cursor-pointer border-r border-border px-3 py-2 text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        ↶
                    </button>

                    <button
                        type="button"
                        onClick={redo}
                        disabled={!canRedo}
                        aria-label="重做"
                        title="重做（Ctrl+Shift+Z）"
                        className="min-w-11 cursor-pointer px-3 py-2 text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                        ↷
                    </button>
                </div>
            </div>

            <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs text-foreground/60 shadow-sm backdrop-blur-sm sm:flex">
                <span>Shift + 拖曳：框選</span>
                <span aria-hidden="true">·</span>
                <span>Space + 拖曳：移動畫布</span>
            </div>

            <NodeEditor />
            <EdgeEditor />

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
