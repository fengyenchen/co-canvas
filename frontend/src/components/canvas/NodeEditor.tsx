import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'

export function NodeEditor() {
    const selectedNode = useCanvasStore(
        (state) =>
            state.nodes.find((node) => node.selected) ?? null,
    )
    const updateNode = useCanvasStore(
        (state) => state.updateNode,
    )
    const deleteNode = useCanvasStore(
        (state) => state.deleteNode,
    )
    const deleteBranch = useCanvasStore(
        (state) => state.deleteBranch,
    )

    const activeContextNodeId = useChatStore(
        (state) => state.activeContextNodeId,
    )

    const setActiveContextNodeId = useChatStore(
        (state) => state.setActiveContextNodeId,
    )

    const isActiveContext =
        activeContextNodeId === selectedNode?.id

    if (!selectedNode) {
        return null
    }

    return (
        <aside className="absolute right-4 top-18 z-20 max-h-[calc(100%-5.5rem)] w-50 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-background p-4 shadow-sm md:top-4 md:max-h-[calc(100%-2rem)] md:w-70 lg:w-80">
            <button
                type="button"
                onClick={() =>
                    setActiveContextNodeId(selectedNode.id)
                }
                className="mb-6 min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:border-primary/30"
            >
                {isActiveContext
                    ? '已設為對話上下文'
                    : '前往對話'}
            </button>

            <label className="block">
                <span className="mb-1 block text-sm text-foreground/70">
                    標題
                </span>

                <input
                    type="text"
                    value={selectedNode.data.title}
                    onChange={(event) =>
                        updateNode(selectedNode.id, {
                            title: event.target.value,
                        })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
            </label>

            <label className="mt-4 block">
                <span className="mb-1 block text-sm text-foreground/70">
                    內容
                </span>

                <textarea
                    value={selectedNode.data.content}
                    onChange={(event) =>
                        updateNode(selectedNode.id, {
                            content: event.target.value,
                        })
                    }
                    rows={5}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
            </label>

            <div className="mt-6 space-y-2 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={() => {
                        deleteNode(selectedNode.id)

                        if (
                            activeContextNodeId &&
                            !useCanvasStore.getState().nodes.some(
                                (node) => node.id === activeContextNodeId,
                            )
                        ) {
                            setActiveContextNodeId(null)
                        }
                    }}
                    className="min-h-11 w-full cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-red-200 hover:text-red-600"
                >
                    只刪除此節點
                </button>

                <button
                    type="button"
                    onClick={() => {
                        deleteBranch(selectedNode.id)

                        if (
                            activeContextNodeId &&
                            !useCanvasStore.getState().nodes.some(
                                (node) => node.id === activeContextNodeId,
                            )
                        ) {
                            setActiveContextNodeId(null)
                        }
                    }}
                    className="min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
                >
                    刪除此分支
                </button>
            </div>
        </aside>
    )
}
