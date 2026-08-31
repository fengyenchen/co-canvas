import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Background,
    Controls,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react'
import type { NodeTypes } from '@xyflow/react'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { Joyride, STATUS } from 'react-joyride'
import type { Step } from 'react-joyride'
import { Link } from 'react-router'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import { renderCanvasPng } from '../../utils/exportCanvasImage'
import {
    createProjectFile,
    downloadFile,
    parseProjectFile,
} from '../../utils/projectFile'
import type { ProjectFile } from '../../utils/projectFile'
import { ConceptNode } from './ConceptNode'
import { VideoNode } from './VideoNode'
import { DocumentNode, ImageNode } from './FileNode'
import { GroupNode } from './GroupNode'
import { EdgeEditor } from './EdgeEditor'
import { NodeEditor } from './NodeEditor'
import { VideoPanel } from '../video/VideoPanel'
import { FilePanel } from '../file/FilePanel'

const nodeTypes: NodeTypes = {
    concept: ConceptNode,
    video: VideoNode,
    document: DocumentNode,
    image: ImageNode,
    group: GroupNode,
}

type CanvasProps = {
    projectName?: string
    isReadOnly?: boolean
    autoStartTour?: boolean
    canRenameProject?: boolean
    canManageProjectPermissions?: boolean
    canCopyProjectLink?: boolean
    canDuplicateProject?: boolean
    canDeleteProject?: boolean
    canViewProjectVersions?: boolean
    canExportResearchData?: boolean
    canManageAiSettings?: boolean
    onRenameProject?: () => void
    onManageProjectPermissions?: () => void
    onDuplicateProject?: () => void
    onDeleteProject?: () => void
    onViewProjectVersions?: () => void
    onExportResearchData?: () => void
    onBeforeImportProject?: () => Promise<void>
    onManageAiSettings?: () => void
    projectAction?: 'idle' | 'duplicating' | 'deleting'
}

function CanvasContent({
    projectName = '專案',
    isReadOnly = false,
    autoStartTour = false,
    canRenameProject = false,
    canManageProjectPermissions = false,
    canCopyProjectLink = false,
    canDuplicateProject = false,
    canDeleteProject = false,
    canViewProjectVersions = false,
    canExportResearchData = false,
    canManageAiSettings = false,
    onRenameProject,
    onManageProjectPermissions,
    onDuplicateProject,
    onDeleteProject,
    onViewProjectVersions,
    onExportResearchData,
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
    const [isTourRunning, setIsTourRunning] = useState(autoStartTour)
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false)
    const [isAddNodeMenuOpen, setIsAddNodeMenuOpen] = useState(false)
    const [pendingImportProject, setPendingImportProject] =
        useState<ProjectFile | null>(null)
    const [isImportingProject, setIsImportingProject] = useState(false)
    const [importError, setImportError] = useState('')
    const [copyLinkState, setCopyLinkState] = useState<
        'idle' | 'copied' | 'error'
    >('idle')

    const tourSteps = useMemo<Step[]>(() => {
        if (autoStartTour) {
            return [
                {
                    target: '[data-tour="add-node"]',
                    placement: 'bottom-start',
                    title: '新增文字節點',
                    content:
                        '按「新增節點」，再選擇「文字節點」，就能把想法、問題或提案方向放進畫布。',
                },
                {
                    target: '.react-flow__node-concept',
                    placement: 'right',
                    title: '開啟節點對話',
                    content:
                        '雙擊任何文字節點即可進入對話。這裡已先開啟競賽題目節點作為示範。',
                },
                {
                    target: '[data-tour="chat-panel"]',
                    placement: 'right',
                    title: '與 AI 對話',
                    content:
                        '對話會帶入目前節點與相鄰節點的脈絡。範例已準備好一段題目發想對話。',
                },
                {
                    target: '[data-tour="generate-nodes"]',
                    placement: 'right',
                    title: '從回覆產生節點',
                    content:
                        'AI 回覆後按「產生節點」，先檢查建議內容，再決定是否加入畫布。',
                },
                {
                    target: '[data-tour="auto-layout"]',
                    placement: 'bottom',
                    title: '自動排版',
                    content:
                        '節點加入後按「自動排版」，即可整理整張畫布。之後還能探索影片片段、文件／圖片附件與群組等進階功能。',
                },
            ]
        }

        const sharedSteps: Step[] = [
            {
                target: '[data-tour="canvas"]',
                placement: 'center',
                title: '歡迎使用 Co-Canvas',
                content:
                    '這裡是專案畫布。你可以整理節點、建立關係，並從文字節點進入 AI 對話。',
            },
        ]

        if (!isReadOnly) {
            sharedSteps.push(
                {
                    target: '[data-tour="add-node"]',
                    placement: 'bottom-start',
                    title: '新增節點',
                    content:
                        '從這裡新增文字、影片、文件或圖片節點。拖曳節點上下端點，可以建立節點之間的連線。',
                },
                {
                    target: '[data-tour="group-nodes"]',
                    placement: 'bottom',
                    title: '建立群組',
                    content:
                        '按住 Shift 框選至少兩個節點後，可把節點整理成可命名、上色、收合與鎖定的群組。',
                },
                {
                    target: '[data-tour="auto-layout"]',
                    placement: 'bottom',
                    title: '自動排版',
                    content:
                        '自動整理節點與群組的位置，同時保留群組內部的結構。',
                },
                {
                    target: '[data-tour="history-controls"]',
                    placement: 'bottom',
                    title: '復原與重做',
                    content:
                        '可復原或重做畫布操作，也支援 Ctrl/Cmd + Z 與 Ctrl/Cmd + Shift + Z。',
                },
            )
        }

        sharedSteps.push(
            {
                target: '[data-tour="project-menu"]',
                placement: 'bottom-end',
                title: '專案功能',
                content: isReadOnly
                    ? '可從這裡匯出目前可查看的專案內容。'
                    : '管理分享、權限、版本、備份、匯入匯出與 AI 設定。',
            },
            {
                target: '[data-tour="search"]',
                placement: 'left',
                title: '搜尋節點',
                content:
                    '依標題或內容搜尋節點，點選結果即可立即移動到該節點。',
            },
            {
                target: '[data-tour="tour-help"]',
                placement: 'left',
                title: '隨時重新查看',
                content: '之後需要複習時，再按這個問號即可重新開始操作導覽。',
            },
        )

        return sharedSteps
    }, [autoStartTour, isReadOnly])

    const edges = useCanvasStore((state) => state.edges)
    const addNode = useCanvasStore((state) => state.addNode)
    const addVideoNode = useCanvasStore((state) => state.addVideoNode)
    const addDocumentNode = useCanvasStore((state) => state.addDocumentNode)
    const addImageNode = useCanvasStore((state) => state.addImageNode)
    const groupSelectedNodes = useCanvasStore(
        (state) => state.groupSelectedNodes,
    )
    const reconcileNodeGroup = useCanvasStore(
        (state) => state.reconcileNodeGroup,
    )
    const onNodesChange = useCanvasStore((state) => state.onNodesChange)
    const onEdgesChange = useCanvasStore((state) => state.onEdgesChange)
    const onConnect = useCanvasStore((state) => state.onConnect)
    const undo = useCanvasStore((state) => state.undo)
    const redo = useCanvasStore((state) => state.redo)
    const copySelection = useCanvasStore((state) => state.copySelection)
    const pasteSelection = useCanvasStore((state) => state.pasteSelection)
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
                `${node.data.title}\n${'content' in node.data ? node.data.content : ''}`
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
    const selectedUngroupedNodeCount = nodes.filter(
        (node) => node.selected && node.type !== 'group' && !node.parentId,
    ).length

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
            setImportError('')
            setPendingImportProject(project)
        } catch {
            setImportError('無法匯入：檔案格式無效或版本不支援。')
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    async function confirmImportProject() {
        if (!pendingImportProject || isImportingProject) {
            return
        }

        setIsImportingProject(true)
        setImportError('')

        try {
            await onBeforeImportProject?.()
            replaceProject(
                pendingImportProject.nodes,
                pendingImportProject.edges,
            )
            replaceProjectMessages(
                pendingImportProject.messages,
                pendingImportProject.suggestionEvents,
            )
            setPendingImportProject(null)

            window.requestAnimationFrame(() => {
                void fitView({
                    padding: 0.2,
                    duration: 300,
                    maxZoom: 1.2,
                })
            })
        } catch {
            setImportError(
                '無法建立匯入前備份，畫布尚未變更。請稍後再試。',
            )
        } finally {
            setIsImportingProject(false)
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
        if (!isTourRunning) return

        function stopTourWithEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsTourRunning(false)
            }
        }

        window.addEventListener('keydown', stopTourWithEscape, true)

        return () => {
            window.removeEventListener('keydown', stopTourWithEscape, true)
        }
    }, [isTourRunning])

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

            if (key === 'c' && copySelection()) {
                event.preventDefault()
                return
            }

            if (key === 'v' && pasteSelection()) {
                event.preventDefault()
                return
            }

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
    }, [copySelection, isReadOnly, pasteSelection, redo, undo])

    return (
        <section
            ref={canvasSectionRef}
            data-tour="canvas"
            className="relative min-h-0 min-w-0 flex-1 bg-canvas"
        >
            <Joyride
                run={isTourRunning}
                steps={tourSteps}
                continuous
                scrollToFirstStep
                onEvent={({ status }) => {
                    if (
                        status === STATUS.FINISHED ||
                        status === STATUS.SKIPPED
                    ) {
                        setIsTourRunning(false)
                    }
                }}
                locale={{
                    back: '上一步',
                    close: '關閉導覽',
                    last: '完成',
                    next: '下一步',
                    nextWithProgress: '下一步（{current}/{total}）',
                    open: '開啟操作導覽',
                    skip: '跳過',
                }}
                options={{
                    backgroundColor: '#f5f5f7',
                    textColor: '#0f172a',
                    primaryColor: '#52525b',
                    arrowColor: '#f5f5f7',
                    overlayColor: 'rgba(15, 23, 42, 0.58)',
                    buttons: ['back', 'close', 'skip', 'primary'],
                    closeButtonAction: 'skip',
                    overlayClickAction: false,
                    skipBeacon: true,
                    showProgress: true,
                    spotlightPadding: 6,
                    spotlightRadius: 10,
                    zIndex: 1000,
                    width: 360,
                }}
                styles={{
                    tooltip: {
                        border: '1px solid #e2e8f0',
                        borderRadius: 16,
                        padding: 20,
                        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.18)',
                    },
                    tooltipContainer: {
                        lineHeight: 1.6,
                        textAlign: 'left',
                    },
                    tooltipTitle: {
                        fontSize: 18,
                        fontWeight: 650,
                        paddingRight: 44,
                    },
                    buttonBack: {
                        minHeight: 44,
                        padding: '8px 12px',
                    },
                    buttonClose: {
                        alignItems: 'center',
                        display: 'flex',
                        height: 44,
                        justifyContent: 'center',
                        right: 8,
                        top: 8,
                        width: 44,
                    },
                    buttonPrimary: {
                        minHeight: 44,
                        borderRadius: 8,
                        padding: '8px 14px',
                    },
                    buttonSkip: {
                        minHeight: 44,
                        padding: '8px 10px',
                    },
                }}
            />

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

            {importError && !pendingImportProject && (
                <div
                    role="alert"
                    className="fixed bottom-4 left-1/2 z-50 flex min-h-11 w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-red-200 bg-background px-4 py-3 text-sm text-red-700 shadow-lg"
                >
                    <span>{importError}</span>
                    <button
                        type="button"
                        onClick={() => setImportError('')}
                        className="min-h-11 shrink-0 cursor-pointer rounded-lg px-3 font-medium text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                        關閉
                    </button>
                </div>
            )}

            {pendingImportProject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-[1px]">
                    <section
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="import-project-title"
                        aria-describedby="import-project-description"
                        className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
                    >
                        <h2
                            id="import-project-title"
                            className="text-xl font-semibold text-foreground"
                        >
                            匯入這份專案？
                        </h2>
                        <p
                            id="import-project-description"
                            className="mt-2 text-sm leading-6 text-foreground/60"
                        >
                            匯入會覆蓋目前的畫布與對話。雲端專案會先建立「匯入前備份」，本機畫布則維持原本的 localStorage 備份方式。
                        </p>
                        <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border bg-canvas/60 p-4 text-sm">
                            <dt className="text-foreground/60">節點</dt>
                            <dd className="text-right text-foreground">
                                {pendingImportProject.nodes.length}
                            </dd>
                            <dt className="text-foreground/60">連線</dt>
                            <dd className="text-right text-foreground">
                                {pendingImportProject.edges.length}
                            </dd>
                            <dt className="text-foreground/60">對話</dt>
                            <dd className="text-right text-foreground">
                                {pendingImportProject.messages.length}
                            </dd>
                        </dl>
                        {importError && (
                            <p
                                role="alert"
                                className="mt-4 text-sm text-red-600"
                            >
                                {importError}
                            </p>
                        )}
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                disabled={isImportingProject}
                                onClick={() => {
                                    setPendingImportProject(null)
                                    setImportError('')
                                }}
                                className="min-h-11 cursor-pointer rounded-lg border border-border px-4 text-sm font-medium text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                autoFocus
                                disabled={isImportingProject}
                                onClick={() => void confirmImportProject()}
                                className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isImportingProject ? '備份並匯入中…' : '確認匯入'}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <div
                data-tour="toolbar"
                className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-2 sm:right-auto sm:justify-start"
            >
                <Link
                    to="/projects"
                    aria-label="返回專案列表"
                    title="返回專案列表"
                    className="flex h-11 min-w-11 flex-1 items-center justify-center rounded-lg border border-border bg-background text-xl text-foreground shadow-sm transition hover:border-primary/30 hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-11 sm:flex-none"
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
                                data-tour="add-node"
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
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddNodeMenuOpen(false)
                                            addDocumentNode(getNewNodePosition())
                                        }}
                                        className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    >
                                        文件節點
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAddNodeMenuOpen(false)
                                            addImageNode(getNewNodePosition())
                                        }}
                                        className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                    >
                                        圖片節點
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            data-tour="group-nodes"
                            onClick={groupSelectedNodes}
                            disabled={selectedUngroupedNodeCount < 2}
                            title="框選至少兩個未分組節點後建立群組"
                            className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-foreground/30 sm:flex-none sm:px-4"
                        >
                            <span className="sm:hidden">群組</span>
                            <span className="hidden sm:inline">建立群組</span>
                        </button>

                        <button
                            type="button"
                            data-tour="auto-layout"
                            onClick={handleAutoLayout}
                            disabled={nodes.length < 2}
                            className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-background px-2 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-background disabled:text-foreground/30 sm:flex-none sm:px-4"
                        >
                            <span className="sm:hidden">排版</span>
                            <span className="hidden sm:inline">自動排版</span>
                        </button>

                        <div
                            data-tour="history-controls"
                            className="flex min-h-11 min-w-22 flex-1 overflow-hidden rounded-lg border border-border bg-background shadow-sm sm:flex-none"
                        >
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
                    <div className="flex min-w-0 overflow-hidden rounded-lg border border-border bg-background shadow-sm transition hover:border-primary/30">
                        <button
                            type="button"
                            disabled={!canRenameProject}
                            onClick={onRenameProject}
                            aria-label={
                                canRenameProject
                                    ? `重新命名「${projectName}」`
                                    : undefined
                            }
                            title={projectName}
                            className="flex min-h-11 min-w-0 max-w-36 flex-1 items-center px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-100 sm:max-w-52"
                        >
                            <span className="truncate">{projectName}</span>
                        </button>
                        <button
                            type="button"
                            data-tour="project-menu"
                            aria-label="開啟專案選單"
                            aria-expanded={isProjectMenuOpen}
                            onClick={() =>
                                setIsProjectMenuOpen((isOpen) => !isOpen)
                            }
                            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center border-l border-border text-foreground/65 transition hover:bg-control-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                        >
                            <ChevronDown
                                aria-hidden="true"
                                className={`size-4 transition-transform ${isProjectMenuOpen ? 'rotate-180' : ''}`}
                            />
                        </button>
                    </div>

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
                        {canExportResearchData && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProjectMenuOpen(false)
                                    onExportResearchData?.()
                                }}
                                className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                匯出研究資料
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

            <div className="absolute right-4 top-16 z-10 flex items-start gap-2 sm:top-4">
                <button
                    type="button"
                    data-tour="tour-help"
                    aria-label="開啟操作導覽"
                    title="操作導覽"
                    onClick={() => {
                        setIsSearchOpen(false)
                        setSearchQuery('')
                        setIsProjectMenuOpen(false)
                        setIsAddNodeMenuOpen(false)
                        setIsTourRunning(false)
                        window.requestAnimationFrame(() => {
                            setIsTourRunning(true)
                        })
                    }}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm transition hover:border-primary/30 hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    <CircleHelp aria-hidden="true" className="size-5" />
                </button>

                <button
                    type="button"
                    data-tour="search"
                    aria-label="搜尋節點"
                    title="搜尋節點"
                    aria-expanded={isSearchOpen}
                    onClick={() => {
                        setIsSearchOpen((isOpen) => !isOpen)
                        setSearchQuery('')
                    }}
                    className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-foreground shadow-sm transition hover:border-primary/30 hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
                                                    {'content' in node.data && node.data.content && (
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
                        <span aria-hidden="true">·</span>
                        <span>Ctrl/Cmd + C／V：複製貼上</span>
                    </>
                )}
            </div>

            {!isReadOnly && <NodeEditor />}
            <VideoPanel isReadOnly={isReadOnly} />
            <FilePanel isReadOnly={isReadOnly} />
            {!isReadOnly && <EdgeEditor />}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={isReadOnly ? undefined : onConnect}
                onNodeDragStop={(_, node) => reconcileNodeGroup(node.id)}
                onNodeDoubleClick={(_, node) => {
                    if (node.type === 'concept' || node.type === 'document' || node.type === 'image' || node.type === 'group') {
                        setActiveContextNodeId(node.id)
                    }
                }}
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly}
                edgesReconnectable={!isReadOnly}
                multiSelectionKeyCode="Shift"
                selectionKeyCode="Shift"
                elevateNodesOnSelect={false}
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
