import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Background,
    Controls,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react'
import type { NodeTypes } from '@xyflow/react'
import { Link } from 'react-router'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import { renderCanvasPng } from '../../utils/exportCanvasImage'
import {
    createProjectFile,
    downloadFile,
    parseProjectFile,
} from '../../utils/projectFile'
import { ConceptNode } from './ConceptNode'
import { VideoNode } from './VideoNode'
import { EdgeEditor } from './EdgeEditor'
import { NodeEditor } from './NodeEditor'
import { VideoPanel } from '../video/VideoPanel'

const nodeTypes: NodeTypes = {
    concept: ConceptNode,
    video: VideoNode,
}

type CanvasProps = {
    isReadOnly?: boolean
    canRenameProject?: boolean
    canManageProjectPermissions?: boolean
    canCopyProjectLink?: boolean
    canDuplicateProject?: boolean
    canDeleteProject?: boolean
    canViewProjectVersions?: boolean
    canManageAiSettings?: boolean
    onRenameProject?: () => void
    onManageProjectPermissions?: () => void
    onDuplicateProject?: () => void
    onDeleteProject?: () => void
    onViewProjectVersions?: () => void
    onBeforeImportProject?: () => Promise<void>
    onManageAiSettings?: () => void
    projectAction?: 'idle' | 'duplicating' | 'deleting'
}

function CanvasContent({
    isReadOnly = false,
    canRenameProject = false,
    canManageProjectPermissions = false,
    canCopyProjectLink = false,
    canDuplicateProject = false,
    canDeleteProject = false,
    canViewProjectVersions = false,
    canManageAiSettings = false,
    onRenameProject,
    onManageProjectPermissions,
    onDuplicateProject,
    onDeleteProject,
    onViewProjectVersions,
    onBeforeImportProject,
    onManageAiSettings,
    projectAction = 'idle',
}: CanvasProps) {
    const nodes = useCanvasStore((state) => state.nodes)
    const { fitView, getNode, screenToFlowPosition, setCenter } = useReactFlow()
    const canvasSectionRef = useRef<HTMLElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
    const [isAddNodeMenuOpen, setIsAddNodeMenuOpen] = useState(false)
    const [copyLinkState, setCopyLinkState] = useState<
        'idle' | 'copied' | 'error'
    >('idle')

    const edges = useCanvasStore((state) => state.edges)
    const addNode = useCanvasStore((state) => state.addNode)
    const addVideoNode = useCanvasStore((state) => state.addVideoNode)
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
    const suggestionEvents = useChatStore(
        (state) => state.suggestionEvents,
    )
    const replaceProjectMessages = useChatStore(
        (state) => state.replaceProjectMessages,
    )
    const setActiveContextNodeId = useChatStore(
        (state) => state.setActiveContextNodeId,
    )
    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase()

        if (!query) {
            return []
        }

        return nodes
            .filter((node) =>
                `${node.data.title}\n${node.data.content}`
                    .toLocaleLowerCase()
                    .includes(query),
            )
            .sort((firstNode, secondNode) => {
                const firstTitleMatches = firstNode.data.title
                    .toLocaleLowerCase()
                    .includes(query)
                const secondTitleMatches = secondNode.data.title
                    .toLocaleLowerCase()
                    .includes(query)

                return Number(secondTitleMatches) - Number(firstTitleMatches)
            })
            .slice(0, 20)
    }, [nodes, searchQuery])

    function getNewNodePosition() {
        const bounds = canvasSectionRef.current?.getBoundingClientRect()
        const center = screenToFlowPosition({
            x: bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2,
            y: bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2,
        })

        return {
            x: center.x - 128,
            y: center.y - 60,
        }
    }

    async function handleCopyProjectLink() {
        try {
            const projectUrl = new URL(
                window.location.pathname,
                window.location.origin,
            ).toString()

            await navigator.clipboard.writeText(projectUrl)
            setCopyLinkState('copied')
        } catch {
            setCopyLinkState('error')
        }

        window.setTimeout(() => setCopyLinkState('idle'), 2000)
    }

    function focusNode(nodeId: string) {
        const node = getNode(nodeId)

        if (!node) {
            return
        }

        onNodesChange(
            nodes.map((canvasNode) => ({
                type: 'select' as const,
                id: canvasNode.id,
                selected: canvasNode.id === nodeId,
            })),
        )

        void setCenter(
            node.position.x + (node.measured?.width ?? 256) / 2,
            node.position.y + (node.measured?.height ?? 80) / 2,
            {
                zoom: 1.15,
                duration: 300,
            },
        )
        if (node.type === 'concept') {
            setActiveContextNodeId(nodeId)
        }
        setIsSearchOpen(false)
        setSearchQuery('')
    }

    function handleAutoLayout() {
        if (isReadOnly) {
            return
        }

        autoLayout()
    }

    function handleExportJson() {
        const project = createProjectFile(
            nodes,
            edges,
            messages,
            suggestionEvents,
        )
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

            if (onBeforeImportProject) {
                try {
                    await onBeforeImportProject()
                } catch {
                    window.alert(
                        '無法建立匯入前備份，畫布尚未變更。請稍後再試。',
                    )
                    return
                }
            }

            replaceProject(project.nodes, project.edges)
            replaceProjectMessages(
                project.messages,
                project.suggestionEvents,
            )

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
        if (nodes.length === 0) {
            window.alert('畫布目前沒有可匯出的節點。')
            return
        }

        try {
            const image = await renderCanvasPng(nodes, edges)
            const date = new Date().toISOString().slice(0, 10)

            downloadFile(
                image,
                `co-canvas-${date}.png`,
                'image/png',
            )
        } catch {
            window.alert('圖片匯出失敗，請稍後再試一次。')
        }
    }

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isReadOnly) {
                return
            }

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
    }, [isReadOnly, redo, undo])

    return (
        <section
            ref={canvasSectionRef}
            className="relative min-h-0 min-w-0 flex-1 bg-canvas"
        >
            {isProjectMenuOpen && (
                <button
                    type="button"
                    aria-label="關閉專案選單"
                    onClick={() => setIsProjectMenuOpen(false)}
                    className="fixed inset-0 z-9 cursor-default bg-transparent"
                />
            )}

            {isAddNodeMenuOpen && (
                <button
                    type="button"
                    aria-label="關閉新增節點選單"
                    onClick={() => setIsAddNodeMenuOpen(false)}
                    className="fixed inset-0 z-9 cursor-default bg-transparent"
                />
            )}

            <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-2 sm:right-auto sm:justify-start">
                <Link
                    to="/projects"
                    aria-label="返回專案列表"
                    title="返回專案列表"
                    className="flex h-11 min-w-11 flex-1 items-center justify-center rounded-lg border border-border bg-background text-xl text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-11 sm:flex-none"
                >
                    <span aria-hidden="true">←</span>
                </Link>

                {isReadOnly ? (
                    <span
                        role="status"
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground/65 shadow-sm sm:flex-none"
                    >
                        僅供檢視
                    </span>
                ) : (
                    <>
                        <div
                            className="relative min-w-0 flex-1 sm:flex-none"
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setIsAddNodeMenuOpen(false)
                                }
                            }}
                        >
                            <button
                                type="button"
                                aria-expanded={isAddNodeMenuOpen}
                                onClick={() =>
                                    setIsAddNodeMenuOpen((isOpen) => !isOpen)
                                }
                                className="min-h-11 w-full cursor-pointer rounded-lg bg-primary px-2 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-4"
                            >
                                <span className="sm:hidden">新增</span>
                                <span className="hidden sm:inline">新增節點</span>
                            </button>

                            {isAddNodeMenuOpen && (
                                <div className="absolute left-0 top-full z-10 mt-2 w-40 overflow-hidden rounded-lg border border-border bg-background p-1 shadow-md">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddNodeMenuOpen(false)
                                            addNode(getNewNodePosition())
                                        }}
                                        className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    >
                                        文字節點
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddNodeMenuOpen(false)
                                            addVideoNode(getNewNodePosition())
                                        }}
                                        className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    >
                                        影片節點
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleAutoLayout}
                            disabled={nodes.length < 2}
                            className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35 sm:flex-none sm:px-4"
                        >
                            <span className="sm:hidden">排版</span>
                            <span className="hidden sm:inline">自動排版</span>
                        </button>

                        <div className="flex min-h-11 min-w-22 flex-1 overflow-hidden rounded-lg border border-border bg-background shadow-sm sm:flex-none">
                            <button
                                type="button"
                                onClick={undo}
                                disabled={!canUndo}
                                aria-label="復原"
                                title="復原（Ctrl+Z）"
                                className="min-w-11 flex-1 cursor-pointer border-r border-border px-2 py-2 text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35 sm:px-3"
                            >
                                ↶
                            </button>

                            <button
                                type="button"
                                onClick={redo}
                                disabled={!canRedo}
                                aria-label="重做"
                                title="重做（Ctrl+Shift+Z）"
                                className="min-w-11 flex-1 cursor-pointer px-2 py-2 text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35 sm:px-3"
                            >
                                ↷
                            </button>
                        </div>
                    </>
                )}

                <div
                    className="relative min-w-0 flex-1 sm:flex-none"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setIsProjectMenuOpen(false)
                        }
                    }}
                >
                    <button
                        type="button"
                        aria-expanded={isProjectMenuOpen}
                        onClick={() =>
                            setIsProjectMenuOpen((isOpen) => !isOpen)
                        }
                        className="flex min-h-11 w-full cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-3"
                    >
                        專案
                    </button>

                    {isProjectMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-lg border border-border bg-background p-1 shadow-md">
                        {canRenameProject && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProjectMenuOpen(false)
                                    onRenameProject?.()
                                }}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                重新命名
                            </button>
                        )}
                        {canManageProjectPermissions && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProjectMenuOpen(false)
                                    onManageProjectPermissions?.()
                                }}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                權限管理
                            </button>
                        )}
                        {canCopyProjectLink && (
                            <button
                                type="button"
                                onClick={() => void handleCopyProjectLink()}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                {copyLinkState === 'copied'
                                    ? '已複製連結'
                                    : copyLinkState === 'error'
                                      ? '複製失敗，請重試'
                                      : '複製分享連結'}
                            </button>
                        )}
                        {canDuplicateProject && (
                            <button
                                type="button"
                                disabled={projectAction !== 'idle'}
                                onClick={() => {
                                    setIsProjectMenuOpen(false)
                                    onDuplicateProject?.()
                                }}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {projectAction === 'duplicating'
                                    ? '複製中…'
                                    : '建立副本'}
                            </button>
                        )}
                        {canViewProjectVersions && (
                            <button
                                type="button"
                                disabled={projectAction !== 'idle'}
                                onClick={() => {
                                    setIsProjectMenuOpen(false)
                                    onViewProjectVersions?.()
                                }}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                版本紀錄
                            </button>
                        )}
                        {canManageAiSettings && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProjectMenuOpen(false)
                                    onManageAiSettings?.()
                                }}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                AI 設定
                            </button>
                        )}
                        {(canRenameProject ||
                            canManageProjectPermissions ||
                            canCopyProjectLink ||
                            canManageAiSettings) && (
                            <div className="my-1 border-t border-border" />
                        )}
                        <button
                            type="button"
                            onClick={handleExportJson}
                            className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10"
                        >
                            匯出 JSON
                        </button>
                        {!isReadOnly && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10"
                            >
                                匯入 JSON
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void handleExportPng()}
                            disabled={nodes.length === 0}
                            className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            匯出 PNG
                        </button>
                        {canDeleteProject && (
                            <>
                                <div className="my-1 border-t border-border" />
                                <button
                                    type="button"
                                    disabled={projectAction !== 'idle'}
                                    onClick={() => {
                                        setIsProjectMenuOpen(false)
                                        onDeleteProject?.()
                                    }}
                                    className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {projectAction === 'deleting'
                                        ? '移動中…'
                                        : '移到垃圾桶'}
                                </button>
                            </>
                        )}
                    </div>
                    )}
                </div>

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

            <div className="absolute right-4 top-16 z-10 sm:top-4">
                <button
                    type="button"
                    aria-label="搜尋節點"
                    aria-expanded={isSearchOpen}
                    onClick={() => {
                        setIsSearchOpen((isOpen) => !isOpen)
                        setSearchQuery('')
                    }}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="size-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-4-4" />
                    </svg>
                </button>

                {isSearchOpen && (
                    <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-background p-3 shadow-lg">
                        <label
                            htmlFor="canvas-node-search"
                            className="mb-2 block text-sm font-medium text-foreground"
                        >
                            搜尋節點
                        </label>
                        <input
                            id="canvas-node-search"
                            type="search"
                            value={searchQuery}
                            autoFocus
                            placeholder="輸入標題或內容"
                            onChange={(event) =>
                                setSearchQuery(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setIsSearchOpen(false)
                                    setSearchQuery('')
                                }
                            }}
                            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition placeholder:text-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />

                        {searchQuery.trim() && (
                            <div className="mt-2 max-h-72 overflow-y-auto">
                                {searchResults.length > 0 ? (
                                    <ul className="space-y-1">
                                        {searchResults.map((node) => (
                                            <li key={node.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        focusNode(node.id)
                                                    }
                                                    className="min-h-11 w-full cursor-pointer rounded-lg px-3 py-2 text-left transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                                >
                                                    <span className="block truncate text-sm font-medium text-foreground">
                                                        {node.data.title ||
                                                            '未命名節點'}
                                                    </span>
                                                    {node.data.content && (
                                                        <span className="mt-0.5 block truncate text-xs text-foreground/60">
                                                            {node.data.content}
                                                        </span>
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="px-3 py-4 text-center text-sm text-foreground/55">
                                        找不到符合的節點
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs text-foreground/60 shadow-sm backdrop-blur-sm sm:flex">
                {isReadOnly ? (
                    <span>可搜尋、縮放、移動畫布及查看對話</span>
                ) : (
                    <>
                        <span>Shift + 拖曳：框選</span>
                        <span aria-hidden="true">·</span>
                        <span>Space + 拖曳：移動畫布</span>
                        <span aria-hidden="true">·</span>
                        <span>雙擊節點：進入對話</span>
                    </>
                )}
            </div>

            {!isReadOnly && <NodeEditor />}
            <VideoPanel isReadOnly={isReadOnly} />
            {!isReadOnly && <EdgeEditor />}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={isReadOnly ? undefined : onConnect}
                onNodeDoubleClick={(_, node) => {
                    if (node.type === 'concept') {
                        setActiveContextNodeId(node.id)
                    }
                }}
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly}
                edgesReconnectable={!isReadOnly}
                deleteKeyCode={isReadOnly ? null : ['Backspace', 'Delete']}
                className="bg-canvas"
                fitView
            >
                <Background />
                <Controls />
            </ReactFlow>
        </section>
    )
}

export function Canvas(props: CanvasProps) {
    return (
        <ReactFlowProvider>
            <CanvasContent {...props} />
        </ReactFlowProvider>
    )
}
