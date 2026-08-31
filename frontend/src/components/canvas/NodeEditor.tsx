import { useEffect, useState } from 'react'
import { Check, Copy, Trash2 } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import type {
    AudioCanvasNode,
    ConceptCanvasNode,
    DocumentCanvasNode,
    GroupCanvasNode,
    VideoCanvasNode,
} from '../../types/canvas'
import {
    formatMediaDuration,
    formatMediaTime,
    formatMediaTimeInput,
    getMediaTimeInputLabel,
    getMediaTimePlaceholder,
    parseMediaTimeInput,
} from '../../utils/mediaTime'
import {
    CONCEPT_NODE_COLOR_OPTIONS,
    GROUP_NODE_COLOR_OPTIONS,
} from '../../utils/nodeColor'

function ConceptNodeEditor({
    selectedNode,
    linkedMediaNodes,
    linkedDocumentNodes,
}: {
    selectedNode: ConceptCanvasNode
    linkedMediaNodes: (VideoCanvasNode | AudioCanvasNode)[]
    linkedDocumentNodes: DocumentCanvasNode[]
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
    const updateConceptDocumentRange = useCanvasStore(
        (state) => state.updateConceptDocumentRange,
    )
    const selectedMedia = linkedMediaNodes.length === 1
        ? linkedMediaNodes[0]
        : undefined
    const selectedMediaDuration = selectedMedia?.data.durationMs
    const selectedMediaLabel = selectedMedia?.type === 'audio' ? '音訊' : '影片'
    const selectedDocument = linkedDocumentNodes.length === 1
        ? linkedDocumentNodes[0]
        : undefined
    const documentPageCount = selectedDocument?.data.pageCount
    const documentPageUnit = selectedDocument?.data.pageUnit === 'slide' ? '投影片' : '頁'
    const storedWholeMediaRange =
        selectedMediaDuration !== undefined &&
        selectedNode.data.startTimeMs === 0 &&
        selectedNode.data.endTimeMs === selectedMediaDuration
    const [draftStartSeconds, setDraftStartSeconds] = useState(
        formatMediaTimeInput(
            selectedNode.data.startTimeMs,
            linkedMediaNodes.length === 1
                ? linkedMediaNodes[0].data.durationMs
                : undefined,
        ),
    )
    const [draftEndSeconds, setDraftEndSeconds] = useState(
        storedWholeMediaRange && selectedMediaDuration !== undefined
            ? formatMediaDuration(selectedMediaDuration)
            : formatMediaTimeInput(
                selectedNode.data.endTimeMs,
                selectedMediaDuration,
            ),
    )
    const [bindingError, setBindingError] = useState<string | null>(null)
    const [isPropertyMenuOpen, setIsPropertyMenuOpen] = useState(false)
    const [isVideoBindingEditorOpen, setIsVideoBindingEditorOpen] =
        useState(false)
    const [isDocumentBindingEditorOpen, setIsDocumentBindingEditorOpen] =
        useState(false)
    const [draftStartPage, setDraftStartPage] = useState(
        String(selectedNode.data.documentStartPage ?? 1),
    )
    const [draftEndPage, setDraftEndPage] = useState(
        String(selectedNode.data.documentEndPage ?? documentPageCount ?? 1),
    )
    const [documentBindingError, setDocumentBindingError] = useState<string | null>(null)
    const [timeRangeMode, setTimeRangeMode] = useState<'all' | 'custom'>(
        storedWholeMediaRange ? 'all' : 'custom',
    )
    const isActiveContext = activeContextNodeId === selectedNode.id
    const hasTimeRange =
        selectedNode.data.startTimeMs !== undefined &&
        selectedNode.data.endTimeMs !== undefined
    const hasDocumentRange =
        selectedNode.data.documentStartPage !== undefined &&
        selectedNode.data.documentEndPage !== undefined

    function applyDocumentBinding() {
        if (linkedDocumentNodes.length === 0) {
            setDocumentBindingError('請先從 PDF 或 PPTX 文件節點連線到此文字節點。')
            return
        }
        if (linkedDocumentNodes.length > 1) {
            setDocumentBindingError('設定頁面範圍的文字節點只能連接一個文件節點。')
            return
        }
        if (!selectedDocument?.data.pageUnit) {
            setDocumentBindingError('這個文件格式沒有可選擇的固定頁面。')
            return
        }
        const startPage = Number(draftStartPage)
        const endPage = Number(draftEndPage)
        if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage) {
            setDocumentBindingError('請輸入有效的開始與結束頁碼。')
            return
        }
        if (documentPageCount !== undefined && endPage > documentPageCount) {
            setDocumentBindingError(`結束${documentPageUnit}不得超過 ${documentPageCount}。`)
            return
        }
        updateConceptDocumentRange(selectedNode.id, {
            documentStartPage: startPage,
            documentEndPage: endPage,
        })
        setDocumentBindingError(null)
        setIsDocumentBindingEditorOpen(false)
    }

    function clearDocumentBinding() {
        updateConceptDocumentRange(selectedNode.id, {
            documentStartPage: undefined,
            documentEndPage: undefined,
        })
        setDocumentBindingError(null)
        setIsDocumentBindingEditorOpen(false)
    }

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
        if (linkedMediaNodes.length === 0) {
            setBindingError('請先從影片或音訊節點連線到此文字節點。')
            return
        }

        if (linkedMediaNodes.length > 1) {
            setBindingError('設定時間區間的文字節點只能連接一個影音來源。')
            return
        }

        if (timeRangeMode === 'all' && selectedMediaDuration !== undefined) {
            updateConceptTimeRange(selectedNode.id, {
                startTimeMs: 0,
                endTimeMs: selectedMediaDuration,
            })
            setDraftStartSeconds(formatMediaTimeInput(0, selectedMediaDuration))
            setDraftEndSeconds(formatMediaDuration(selectedMediaDuration))
            setBindingError(null)
            setIsVideoBindingEditorOpen(false)
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
            selectedMedia?.data.durationMs !== undefined &&
            endTimeMs > selectedMedia.data.durationMs
        ) {
            setBindingError(`結束時間不得超出${selectedMediaLabel}長度。`)
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
        setTimeRangeMode(storedWholeMediaRange ? 'all' : 'custom')
        setIsVideoBindingEditorOpen(false)
    }

    function closeVideoBindingEditor() {
        const isWholeVideoRange =
            selectedMediaDuration !== undefined &&
            selectedNode.data.startTimeMs === 0 &&
            selectedNode.data.endTimeMs === selectedMediaDuration
        setDraftStartSeconds(
            formatMediaTimeInput(
                selectedNode.data.startTimeMs,
                selectedMedia?.data.durationMs,
            ),
        )
        setDraftEndSeconds(
            isWholeVideoRange
                ? formatMediaDuration(selectedMediaDuration)
                : formatMediaTimeInput(
                    selectedNode.data.endTimeMs,
                    selectedMediaDuration,
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
                    {(!hasTimeRange || !hasDocumentRange) &&
                        !isVideoBindingEditorOpen && !isDocumentBindingEditorOpen && (
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
                                            影音時間區間
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsPropertyMenuOpen(false)
                                                setIsDocumentBindingEditorOpen(true)
                                            }}
                                            className="min-h-11 w-full cursor-pointer rounded-md px-3 text-left text-sm text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                        >
                                            文件頁面範圍
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
                                影音時間區間
                            </span>
                            <span className="mt-1 block text-xs text-foreground/55">
                                {selectedMedia?.data.title ?? '尚未連接影音來源'} ·{' '}
                                {storedWholeMediaRange
                                    ? `全部${selectedMediaLabel}`
                                    : <>
                                        {formatMediaTime(
                                            selectedNode.data.startTimeMs ?? 0,
                                            selectedMedia?.data.durationMs,
                                        )}–
                                        {formatMediaTime(
                                            selectedNode.data.endTimeMs ?? 0,
                                            selectedMedia?.data.durationMs,
                                        )}
                                    </>}
                            </span>
                        </button>
                    )}

                {isVideoBindingEditorOpen && (
                    <div className="mt-3 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-foreground">
                                影音時間區間
                            </h4>
                            <button
                                type="button"
                                onClick={closeVideoBindingEditor}
                                className="min-h-9 cursor-pointer rounded-md px-2 text-xs text-foreground/60 transition hover:bg-primary/5 hover:text-foreground"
                            >
                                收起
                            </button>
                        </div>

                        {linkedMediaNodes.length === 0 ? (
                            <p className="mt-2 text-sm text-foreground/55">
                                先從影片或音訊節點連線到此文字節點，才能設定時間區間。
                            </p>
                        ) : linkedMediaNodes.length > 1 ? (
                            <p className="mt-2 text-sm text-red-600">
                                此文字節點連接了多個影音節點，請只保留一個影音來源。
                            </p>
                        ) : (
                            <>
                        <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground/70">
                            {selectedMediaLabel}來源：{selectedMedia?.data.title}
                        </p>

                        {selectedMediaDuration && (
                            <p className="mt-2 text-xs text-foreground/55">
                                {selectedMediaLabel}長度：{formatMediaDuration(selectedMediaDuration)}
                            </p>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="影音時間範圍">
                            <button
                                type="button"
                                disabled={!selectedMediaDuration}
                                onClick={() => {
                                    if (selectedMediaDuration === undefined) return
                                    setDraftStartSeconds(formatMediaTimeInput(0, selectedMediaDuration))
                                    setDraftEndSeconds(formatMediaDuration(selectedMediaDuration))
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

                        {!selectedMediaDuration && (
                            <p className="mt-2 text-xs leading-5 text-foreground/50">
                                播放器取得{selectedMediaLabel}總長度後，即可選擇全部。
                            </p>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <label>
                                <span className="mb-1 block text-xs text-foreground/70">
                                    {getMediaTimeInputLabel('開始', selectedMediaDuration)}
                                </span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={getMediaTimePlaceholder(selectedMediaDuration)}
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
                                    {getMediaTimeInputLabel('結束', selectedMediaDuration)}
                                </span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder={getMediaTimePlaceholder(selectedMediaDuration)}
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

                {hasDocumentRange && !isDocumentBindingEditorOpen && (
                    <button
                        type="button"
                        onClick={() => setIsDocumentBindingEditorOpen(true)}
                        className="mt-3 w-full cursor-pointer rounded-lg border border-border px-3 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                        <span className="block text-sm font-medium text-foreground">文件頁面範圍</span>
                        <span className="mt-1 block text-xs text-foreground/55">
                            {selectedDocument?.data.title ?? '尚未連接文件'} · 第 {selectedNode.data.documentStartPage}–{selectedNode.data.documentEndPage} {documentPageUnit}
                        </span>
                    </button>
                )}

                {isDocumentBindingEditorOpen && (
                    <div className="mt-3 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-foreground">文件頁面範圍</h4>
                            <button
                                type="button"
                                onClick={() => {
                                    setDocumentBindingError(null)
                                    setIsDocumentBindingEditorOpen(false)
                                }}
                                className="min-h-9 cursor-pointer rounded-md px-2 text-xs text-foreground/60 transition hover:bg-primary/5 hover:text-foreground"
                            >
                                取消
                            </button>
                        </div>
                        {linkedDocumentNodes.length === 0 ? (
                            <p className="mt-2 text-sm text-foreground/55">先從 PDF 或 PPTX 文件節點連線到此文字節點。</p>
                        ) : linkedDocumentNodes.length > 1 ? (
                            <p className="mt-2 text-sm text-red-600">此文字節點連接了多個文件節點，請只保留一個文件來源。</p>
                        ) : !selectedDocument?.data.pageUnit ? (
                            <p className="mt-2 text-sm text-foreground/55">這個文件格式沒有固定頁面；對話會分析完整文件。</p>
                        ) : (
                            <>
                                <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground/70">
                                    文件來源：{selectedDocument.data.title}
                                    {documentPageCount ? ` · ${documentPageCount} ${documentPageUnit}` : ''}
                                </p>
                                {documentPageCount && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDraftStartPage('1')
                                            setDraftEndPage(String(documentPageCount))
                                            setDocumentBindingError(null)
                                        }}
                                        className="mt-3 min-h-11 w-full cursor-pointer rounded-lg border border-border px-3 text-sm text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                                    >
                                        全部
                                    </button>
                                )}
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <label>
                                        <span className="mb-1 block text-xs text-foreground/70">開始{documentPageUnit}</span>
                                        <input type="number" min={1} max={documentPageCount} value={draftStartPage} onChange={(event) => { setDraftStartPage(event.target.value); setDocumentBindingError(null) }} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                                    </label>
                                    <label>
                                        <span className="mb-1 block text-xs text-foreground/70">結束{documentPageUnit}</span>
                                        <input type="number" min={1} max={documentPageCount} value={draftEndPage} onChange={(event) => { setDraftEndPage(event.target.value); setDocumentBindingError(null) }} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                                    </label>
                                </div>
                                {documentBindingError && <p role="alert" className="mt-2 text-xs text-red-600">{documentBindingError}</p>}
                                <div className="mt-3 flex gap-2">
                                    {hasDocumentRange && <button type="button" onClick={clearDocumentBinding} className="min-h-11 flex-1 rounded-lg border border-border px-3 text-sm">刪除屬性</button>}
                                    <button type="button" onClick={applyDocumentBinding} className="min-h-11 flex-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">套用</button>
                                </div>
                            </>
                        )}
                        {documentBindingError && (linkedDocumentNodes.length !== 1 || !selectedDocument?.data.pageUnit) && <p role="alert" className="mt-2 text-xs text-red-600">{documentBindingError}</p>}
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
    const toggleGroupCollapsed = useCanvasStore(
        (state) => state.toggleGroupCollapsed,
    )
    const toggleGroupLocked = useCanvasStore(
        (state) => state.toggleGroupLocked,
    )
    const duplicateGroup = useCanvasStore((state) => state.duplicateGroup)
    const ungroupNodes = useCanvasStore((state) => state.ungroupNodes)
    const deleteGroup = useCanvasStore((state) => state.deleteGroup)
    const memberCount = useCanvasStore(
        (state) =>
            state.nodes.filter((node) => node.parentId === selectedNode.id).length,
    )
    const activeContextNodeId = useChatStore(
        (state) => state.activeContextNodeId,
    )
    const setActiveContextNodeId = useChatStore(
        (state) => state.setActiveContextNodeId,
    )
    const isActiveContext = activeContextNodeId === selectedNode.id

    useEffect(() => {
        function handleDeleteShortcut(event: KeyboardEvent) {
            if (
                event.defaultPrevented ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                (event.key !== 'Delete' && event.key !== 'Backspace')
            ) {
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

            event.preventDefault()
            deleteGroup(selectedNode.id)
        }

        window.addEventListener('keydown', handleDeleteShortcut, true)
        return () => window.removeEventListener('keydown', handleDeleteShortcut, true)
    }, [deleteGroup, selectedNode.id])

    return (
        <aside className="absolute right-4 top-18 z-20 max-h-[calc(100%-5.5rem)] w-50 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-background p-4 shadow-sm md:top-4 md:max-h-[calc(100%-2rem)] md:w-70 lg:w-80">
            <button
                type="button"
                onClick={() => setActiveContextNodeId(selectedNode.id)}
                className="mb-4 min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:border-primary/30 hover:bg-control-hover"
            >
                {isActiveContext ? '已設為群組對話上下文' : '前往群組對話'}
            </button>

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

            <fieldset className="mt-4">
                <legend className="mb-2 text-sm text-foreground/70">
                    群組顏色
                </legend>
                <div className="flex flex-wrap gap-2">
                    {GROUP_NODE_COLOR_OPTIONS.map((option) => {
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
                                    updateGroup(selectedNode.id, {
                                        color: option.value,
                                    })
                                }
                                className="flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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

            <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => toggleGroupCollapsed(selectedNode.id)}
                    className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    {selectedNode.data.collapsed ? '展開群組' : '收合群組'}
                </button>
                <button
                    type="button"
                    aria-pressed={Boolean(selectedNode.data.locked)}
                    onClick={() => toggleGroupLocked(selectedNode.id)}
                    className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    {selectedNode.data.locked ? '解除鎖定' : '鎖定群組'}
                </button>
            </div>

            <button
                type="button"
                onClick={() => duplicateGroup(selectedNode.id)}
                className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
                <Copy aria-hidden="true" className="size-4" />
                複製整個群組
            </button>

            <p className="mt-4 text-sm leading-6 text-foreground/55">
                {selectedNode.data.locked
                    ? '群組已鎖定，框與成員節點都不會被手動移動。'
                    : '拖曳框內空白處可移動整組；將節點拖到框外超過一半，即會移出群組。'}
            </p>

            <div className="mt-6 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={() => ungroupNodes(selectedNode.id)}
                    className="min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                    解散群組
                </button>
                <button
                    type="button"
                    onClick={() => deleteGroup(selectedNode.id)}
                    className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                    <span className="flex items-center gap-2">
                        <Trash2 aria-hidden="true" className="size-4" />
                        刪除整個群組
                    </span>
                    <kbd className="rounded border border-red-200 bg-background px-1.5 py-0.5 font-mono text-[11px] leading-none text-red-600/80">
                        Del
                    </kbd>
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

    const linkedSourceNodeIds = new Set(
        edges
            .filter((edge) => edge.target === selectedNode.id)
            .map((edge) => edge.source),
    )
    const linkedMediaNodes = nodes.filter(
        (node): node is VideoCanvasNode | AudioCanvasNode =>
            (node.type === 'video' || node.type === 'audio') &&
            linkedSourceNodeIds.has(node.id),
    )
    const linkedDocumentNodes = nodes.filter(
        (node): node is DocumentCanvasNode =>
            node.type === 'document' && linkedSourceNodeIds.has(node.id),
    )

    return (
        <ConceptNodeEditor
            key={selectedNode.id}
            selectedNode={selectedNode}
            linkedMediaNodes={linkedMediaNodes}
            linkedDocumentNodes={linkedDocumentNodes}
        />
    )
}
