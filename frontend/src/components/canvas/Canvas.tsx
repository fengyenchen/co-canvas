import { useEffect, useRef } from 'react'
import {
    Background,
    Controls,
    getNodesBounds,
    getViewportForBounds,
    ReactFlow,
    ReactFlowProvider,
    useNodesInitialized,
    useReactFlow,
} from '@xyflow/react'
import type { NodeTypes } from '@xyflow/react'
import { toPng } from 'html-to-image'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import {
    createProjectFile,
    downloadFile,
    parseProjectFile,
} from '../../utils/projectFile'
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
    const canvasSectionRef = useRef<HTMLElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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
    const replaceProject = useCanvasStore(
        (state) => state.replaceProject,
    )
    const messages = useChatStore((state) => state.messages)
    const replaceProjectMessages = useChatStore(
        (state) => state.replaceProjectMessages,
    )
    const setActiveContextNodeId = useChatStore(
        (state) => state.setActiveContextNodeId,
    )

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

    function handleExportJson() {
        const project = createProjectFile(nodes, edges, messages)
        const date = new Date().toISOString().slice(0, 10)

        downloadFile(
            JSON.stringify(project, null, 2),
            `co-canvas-${date}.json`,
            'application/json',
        )
    }

    async function handleImportJson(file: File) {
        try {
            const project = parseProjectFile(
                JSON.parse(await file.text()),
            )

            if (
                !window.confirm(
                    '匯入會覆蓋目前的畫布與對話，確定要繼續嗎？',
                )
            ) {
                return
            }

            replaceProject(project.nodes, project.edges)
            replaceProjectMessages(project.messages)

            window.requestAnimationFrame(() => {
                void fitView({
                    padding: 0.2,
                    duration: 300,
                    maxZoom: 1.2,
                })
            })
        } catch {
            window.alert('無法匯入：檔案格式無效或版本不支援。')
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    async function handleExportPng() {
        const viewport = canvasSectionRef.current
            ?.querySelector<HTMLElement>('.react-flow__viewport')

        if (!viewport || nodes.length === 0) {
            window.alert('畫布目前沒有可匯出的節點。')
            return
        }

        const width = 1920
        const height = 1080
        const bounds = getNodesBounds(nodes)
        const { x, y, zoom } = getViewportForBounds(
            bounds,
            width,
            height,
            0.1,
            2,
            0.12,
        )
        const dataUrl = await toPng(viewport, {
            backgroundColor: '#eeeef1',
            width,
            height,
            filter: (element) =>
                !(
                    element instanceof HTMLElement &&
                    element.classList.contains('react-flow__handle')
                ),
            style: {
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(${x}px, ${y}px) scale(${zoom})`,
            },
        })
        const link = document.createElement('a')
        const date = new Date().toISOString().slice(0, 10)

        link.href = dataUrl
        link.download = `co-canvas-${date}.png`
        link.click()
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
        <section
            ref={canvasSectionRef}
            className="relative h-full min-w-0 flex-1 bg-canvas"
        >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-1 sm:gap-2">
                <button
                    type="button"
                    onClick={addNode}
                    className="min-h-11 cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4"
                >
                    <span className="sm:hidden">新增</span>
                    <span className="hidden sm:inline">新增節點</span>
                </button>

                <button
                    type="button"
                    onClick={handleAutoLayout}
                    disabled={nodes.length < 2}
                    className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
                >
                    <span className="sm:hidden">排版</span>
                    <span className="hidden sm:inline">自動排版</span>
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

                <details className="group relative">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        專案
                    </summary>

                    <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-lg border border-border bg-background p-1 shadow-md">
                        <button
                            type="button"
                            onClick={handleExportJson}
                            className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10"
                        >
                            匯出 JSON
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10"
                        >
                            匯入 JSON
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleExportPng()}
                            disabled={nodes.length === 0}
                            className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            匯出 PNG
                        </button>
                    </div>
                </details>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0]

                        if (file) {
                            void handleImportJson(file)
                        }
                    }}
                />
            </div>

            <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs text-foreground/60 shadow-sm backdrop-blur-sm sm:flex">
                <span>Shift + 拖曳：框選</span>
                <span aria-hidden="true">·</span>
                <span>Space + 拖曳：移動畫布</span>
                <span aria-hidden="true">·</span>
                <span>雙擊節點：進入對話</span>
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
                onNodeDoubleClick={(_, node) =>
                    setActiveContextNodeId(node.id)
                }
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
