import { useState } from 'react'
import { Check } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import type {
    ConceptCanvasNode,
    GroupCanvasNode,
    VideoCanvasNode,
} from '../../types/canvas'
import {
    formatMediaTime,
    formatMediaTimeInput,
    getMediaTimeInputLabel,
    getMediaTimePlaceholder,
    parseMediaTimeInput,
} from '../../utils/mediaTime'
import { CONCEPT_NODE_COLOR_OPTIONS } from '../../utils/nodeColor'

function ConceptNodeEditor({
    selectedNode,
    linkedVideoNodes,
}: {
    selectedNode: ConceptCanvasNode
    linkedVideoNodes: VideoCanvasNode[]
}) {
    const updateNode = useCanvasStore((state) => state.updateNode)
    const updateConceptTimeRange = useCanvasStore(
        (state) => state.updateConceptTimeRange,
    )
    const deleteNode = useCanvasStore((state) => state.deleteNode)
    const deleteBranch = useCanvasStore((state) => state.deleteBranch)
    const activeContextNodeId = useChatStore(
        (state) => state.activeContextNodeId,
    )
    const setActiveContextNodeId = useChatStore(
        (state) => state.setActiveContextNodeId,
    )
    const selectedVideo = linkedVideoNodes.length === 1
        ? linkedVideoNodes[0]
        : undefined
    const selectedVideoDuration = selectedVideo?.data.durationMs
    const storedWholeVideoRange =
        selectedVideoDuration !== undefined &&
        selectedNode.data.startTimeMs === 0 &&
        selectedNode.data.endTimeMs === selectedVideoDuration
    const [draftStartSeconds, setDraftStartSeconds] = useState(
        formatMediaTimeInput(
            selectedNode.data.startTimeMs,
            linkedVideoNodes.length === 1
                ? linkedVideoNodes[0].data.durationMs
                : undefined,
        ),
    )
    const [draftEndSeconds, setDraftEndSeconds] = useState(
        formatMediaTimeInput(
            selectedNode.data.endTimeMs,
            linkedVideoNodes.length === 1
                ? linkedVideoNodes[0].data.durationMs
                : undefined,
        ),
    )
    const [bindingError, setBindingError] = useState<string | null>(null)
    const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false)
    const [isVideoBindingEditorOpen, setIsVideoBindingEditorOpen] =
        useState(false)
    const [timeRangeMode, setTimeRangeMode] = useState<'all' | 'custom'>(
        storedWholeVideoRange ? 'all' : 'custom',
    )
    const isActiveContext = activeContextNodeId === selectedNode.id
    const hasTimeRange =
        selectedNode.data.startTimeMs !== undefined &&
        selectedNode.data.endTimeMs !== undefined

    function clearMissingActiveContext() {
        if (
            activeContextNodeId &&
            !useCanvasStore
                .getState()
                .nodes.some((node) => node.id === activeContextNodeId)
        ) {
            setActiveContextNodeId(null)
        }
    }

    function applyVideoBinding() {
        if (linkedVideoNodes.length === 0) {
            setBindingError('請先從影片節點連線到此文字節點。')
            return
        }

        if (linkedVideoNodes.length > 1) {
            setBindingError('設定時間區間的文字節點只能連接一個影片節點。')
            return
        }

        if (!draftStartSeconds.trim() || !draftEndSeconds.trim()) {
            setBindingError('開始與結束時間都必須填寫。')
            return
        }

        const startSeconds = parseMediaTimeInput(draftStartSeconds)
        const endSeconds = parseMediaTimeInput(draftEndSeconds)

        if (
            startSeconds === null ||
            endSeconds === null
        ) {
            setBindingError('請依欄位提示輸入有效的時間。')
            return
        }

        if (endSeconds <= startSeconds) {
            setBindingError('結束時間必須晚於開始時間。')
            return
        }

        const startTimeMs = Math.round(startSeconds * 1000)
        const endTimeMs = Math.round(endSeconds * 1000)

        if (
            selectedVideo?.data.durationMs !== undefined &&
            endTimeMs > selectedVideo.data.durationMs
        ) {
            setBindingError('結束時間不得超出影片長度。')
            return
        }

        updateConceptTimeRange(selectedNode.id, {
            startTimeMs,
            endTimeMs,
        })
        setBindingError(null)
        setTimeRangeMode('custom')
        setIsVideoBindingEditorOpen(false)
    }

    function clearVideoBinding() {
        updateConceptTimeRange(selectedNode.id, {
            startTimeMs: undefined,
            endTimeMs: undefined,
        })
        setDraftStartSeconds('')
        setDraftEndSeconds('')
        setBindingError(null)
        setTimeRangeMode(storedWholeVideoRange ? 'all' : 'custom')
        setIsVideoBindingEditorOpen(false)
    }

    function closeVideoBindingEditor() {
        setDraftStartSeconds(
            formatMediaTimeInput(
                selectedNode.data.startTimeMs,
                selectedVideo?.data.durationMs,
            ),
        )
        setDraftEndSeconds(
            formatMediaTimeInput(
                selectedNode.data.endTimeMs,
                selectedVideo?.data.durationMs,
            ),
        )
        setBindingError(null)
        setIsVideoBindingEditorOpen(false)
    }

    return (
        <aside className="absolute right-4 top-18 z-20 max-h-[calc(100%-5.5rem)] w-50 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-background p-4 shadow-sm md:top-4 md:max-h-[calc(100%-2rem)] md:w-70 lg:w-80">
            <button
                type="button"
                onClick={() => setActiveContextNodeId(selectedNode.id)}
                className="mb-6 min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:border-primary/30"
            >
                {isActiveContext ? '已設為對話上下文' : '前往對話'}
            </button>

            <label className="block">
                <span className="mb-1 block text-sm text-foreground/70">標題</span>
                <input
                    type="text"
                    value={selectedNode.data.title}
                    onChange={(event) =>
                        updateNode(selectedNode.id, { title: event.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
            </label>

            <label className="mt-4 block">
                <span className="mb-1 block text-sm text-foreground/70">內容</span>
                <textarea
                    value={selectedNode.data.content}
                    onChange={(event) =>
                        updateNode(selectedNode.id, { content: event.target.value })
                    }
                    rows={5}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
            </label>

            <fieldset className="mt-4">
                <legend className="mb-2 text-sm text-foreground/70">
                    節點顏色
                </legend>
                <div className="flex flex-wrap gap-2">
                    {CONCEPT_NODE_COLOR_OPTIONS.map((option) => {
                        const isSelected =
                            (selectedNode.data.color ?? 'default') === option.value

                        return (
                            <button
                                key={option.value}
                                type="button"
                                aria-label={option.label}
                                aria-pressed={isSelected}
                                title={option.label}
                                onClick={() =>
                                    updateNode(selectedNode.id, { color: option.value })
                                }
                                className="flex size-11 cursor-pointer items-center justify-center rounded-full transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                <span
                                    className={`flex size-7 items-center justify-center rounded-full border ${option.swatchClassName} ${isSelected
                                        ? 'border-primary ring-2 ring-primary/25'
                                        : 'border-foreground/15'}`}
                                >
                                    {isSelected && (
                                        <Check
                                            aria-hidden="true"
                                            className="size-3.5 text-foreground/75"
                                        />
                                    )}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </fieldset>

            <div className="mt-6 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                        屬性
                    </h3>
                    {!hasTimeRange &&
                        !isVideoBindingEditorOpen && (
                            <div className="relative">
                                <button
                                    type="button"
                                    aria-expanded={isPropertyMenuOpen}
                                    onClick={() =>
                                        setIsPropertyMenuOpen(
                                            (isOpen) => !isOpen,
                                        )
                                    }
                                    className="min-h-9 cursor-pointer rounded-lg border border-border px-3 text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                >
                                    ＋ 新增屬性
                                </button>
                                {isPropertyMenuOpen && (
                                    <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-lg border border-border bg-background p-1 shadow-md">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsPropertyMenuOpen(false)
                                                setIsVideoBindingEditorOpen(true)
                                            }}
                                            className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        >
                                            影片時間區間
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                </div>

                {hasTimeRange &&
                    !isVideoBindingEditorOpen && (
                        <button
                            type="button"
                            onClick={() => setIsVideoBindingEditorOpen(true)}
                            className="mt-3 w-full cursor-pointer rounded-lg border border-border px-3 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                            <span className="block text-sm font-medium text-foreground">
                                影片時間區間
                            </span>
                            <span className="mt-1 block text-xs text-foreground/55">
                                {selectedVideo?.data.title ?? '尚未連接影片'} ·{' '}
                                {storedWholeVideoRange
                                    ? '全部影片'
                                    : <>
                                        {formatMediaTime(
                                            selectedNode.data.startTimeMs ?? 0,
                                            selectedVideo?.data.durationMs,
                                        )}–
                                        {formatMediaTime(
                                            selectedNode.data.endTimeMs ?? 0,
                                            selectedVideo?.data.durationMs,
                                        )}
                                    </>}
                            </span>
                        </button>
                    )}

                {isVideoBindingEditorOpen && (
                    <div className="mt-3 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-foreground">
                                影片時間區間
                            </h4>
                            <button
                                type="button"
                                onClick={closeVideoBindingEditor}
                                className="min-h-9 cursor-pointer rounded-md px-2 text-xs text-foreground/60 transition hover:bg-primary/5 hover:text-foreground"
                            >
                                收起
                            </button>
                        </div>

                        {linkedVideoNodes.length === 0 ? (
                            <p className="mt-2 text-sm text-foreground/55">
                                先從影片節點連線到此文字節點，才能設定時間區間。
                            </p>
                        ) : linkedVideoNodes.length > 1 ? (
                            <p className="mt-2 text-sm text-red-600">
                                此文字節點連接了多個影片節點，請只保留一個影片來源。
                            </p>
                        ) : (
                            <>
                        <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground/70">
                            影片來源：{selectedVideo?.data.title}
                        </p>

                        {selectedVideoDuration && (
                            <p className="mt-2 text-xs text-foreground/55">
                                影片長度：{formatMediaTime(
                                    selectedVideoDuration,
                                    selectedVideoDuration,
                                )}
                            </p>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="影片時間範圍">
                            <button
                                type="button"
                                disabled={!selectedVideoDuration}
                                onClick={() => {
                                    setDraftStartSeconds(formatMediaTimeInput(0, selectedVideoDuration))
                                    setDraftEndSeconds(formatMediaTimeInput(selectedVideoDuration, selectedVideoDuration))
                                    setTimeRangeMode('all')
                                    setBindingError(null)
                                }}
                                className={`min-h-11 cursor-pointer rounded-lg border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${timeRangeMode === 'all'
                                    ? 'border-primary/25 bg-primary/5 text-primary'
                                    : 'border-border text-foreground hover:border-primary/30 hover:bg-primary/5'}`}
                            >
                                全部
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setTimeRangeMode('custom')
                                    setBindingError(null)
                                }}
                                className={`min-h-11 cursor-pointer rounded-lg border px-3 text-sm transition ${timeRangeMode === 'custom'
                                    ? 'border-primary/25 bg-primary/5 text-primary'
                                    : 'border-border text-foreground hover:border-primary/30 hover:bg-primary/5'}`}
                            >
                                自訂區間
                            </button>
                        </div>

                        {!selectedVideoDuration && (
                            <p className="mt-2 text-xs leading-5 text-foreground/50">
                                播放器取得影片總長度後，即可選擇全部影片。
                            </p>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <label>
                                <span className="mb-1 block text-xs text-foreground/70">
                                    {getMediaTimeInputLabel('開始', selectedVideoDuration)}
                                </span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={getMediaTimePlaceholder(selectedVideoDuration)}
                                    value={draftStartSeconds}
                                    onChange={(event) => {
                                        setDraftStartSeconds(event.target.value)
                                        setTimeRangeMode('custom')
                                        setBindingError(null)
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                />
                            </label>
                            <label>
                                <span className="mb-1 block text-xs text-foreground/70">
                                    {getMediaTimeInputLabel('結束', selectedVideoDuration)}
                                </span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={getMediaTimePlaceholder(selectedVideoDuration)}
                                    value={draftEndSeconds}
                                    onChange={(event) => {
                                        setDraftEndSeconds(event.target.value)
                                        setTimeRangeMode('custom')
                                        setBindingError(null)
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                />
                            </label>
                        </div>

                        {bindingError && (
                            <p role="alert" className="mt-2 text-xs text-red-600">
                                {bindingError}
                            </p>
                        )}

                        <div className="mt-3 flex gap-2">
                            {hasTimeRange && (
                                <button
                                    type="button"
                                    onClick={clearVideoBinding}
                                    className="min-h-11 flex-1 cursor-pointer rounded-lg border border-border px-3 text-sm text-foreground transition hover:bg-primary/5"
                                >
                                    刪除屬性
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={applyVideoBinding}
                                className="min-h-11 flex-1 cursor-pointer rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                套用
                            </button>
                        </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-6 space-y-2 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={() => {
                        deleteNode(selectedNode.id)
                        clearMissingActiveContext()
                    }}
                    className="min-h-11 w-full cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-red-200 hover:text-red-600"
                >
                    只刪除此節點
                </button>

                <button
                    type="button"
                    onClick={() => {
                        deleteBranch(selectedNode.id)
                        clearMissingActiveContext()
                    }}
                    className="min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                >
                    刪除此分支
                </button>
            </div>
        </aside>
    )
}

function GroupNodeEditor({ selectedNode }: { selectedNode: GroupCanvasNode }) {
    const updateGroup = useCanvasStore((state) => state.updateGroup)
    const ungroupNodes = useCanvasStore((state) => state.ungroupNodes)
    const memberCount = useCanvasStore(
        (state) =>
            state.nodes.filter((node) => node.parentId === selectedNode.id).length,
    )

    return (
        <aside className="absolute right-4 top-18 z-20 max-h-[calc(100%-5.5rem)] w-50 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-background p-4 shadow-sm md:top-4 md:max-h-[calc(100%-2rem)] md:w-70 lg:w-80">
            <p className="mb-6 rounded-lg border border-border px-4 py-3 text-sm text-foreground/65">
                群組內有 {memberCount} 個節點
            </p>

            <label className="block">
                <span className="mb-1 block text-sm text-foreground/70">
                    群組名稱
                </span>
                <input
                    type="text"
                    value={selectedNode.data.title}
                    onChange={(event) =>
                        updateGroup(selectedNode.id, { title: event.target.value })
                    }
                    className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
            </label>

            <p className="mt-4 text-sm leading-6 text-foreground/55">
                拖曳框內空白處可移動整組；將節點拖到框外超過一半，即會移出群組。
            </p>

            <div className="mt-6 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={() => ungroupNodes(selectedNode.id)}
                    className="min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                    解散群組
                </button>
            </div>
        </aside>
    )
}

export function NodeEditor() {
    const nodes = useCanvasStore((state) => state.nodes)
    const edges = useCanvasStore((state) => state.edges)
    const selectedGroup = nodes.find(
        (node): node is GroupCanvasNode =>
            Boolean(node.selected && node.type === 'group'),
    )
    if (selectedGroup) {
        return <GroupNodeEditor key={selectedGroup.id} selectedNode={selectedGroup} />
    }

    const selectedNode = nodes.find(
        (node): node is ConceptCanvasNode =>
            Boolean(node.selected && node.type === 'concept'),
    )
    if (!selectedNode) return null

    const linkedVideoNodeIds = new Set(
        edges
            .filter((edge) => edge.target === selectedNode.id)
            .map((edge) => edge.source),
    )
    const linkedVideoNodes = nodes.filter(
        (node): node is VideoCanvasNode =>
            node.type === 'video' && linkedVideoNodeIds.has(node.id),
    )

    return (
        <ConceptNodeEditor
            key={selectedNode.id}
            selectedNode={selectedNode}
            linkedVideoNodes={linkedVideoNodes}
        />
    )
}
