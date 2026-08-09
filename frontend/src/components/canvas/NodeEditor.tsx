import { useCanvasStore } from '../../stores/canvasStore'

export function NodeEditor() {
    const selectedNode = useCanvasStore(
        (state) =>
            state.nodes.find((node) => node.selected) ?? null,
    )
    const updateNode = useCanvasStore(
        (state) => state.updateNode,
    )

    if (!selectedNode) {
        return null
    }

    return (
        <aside className="absolute right-4 top-4 z-10 w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-background p-4 shadow-sm">
            <button
                type="button"
                className="w-full mb-6 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground hover:border-primary/30 transition cursor-pointer"
            >
                前往對話
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
        </aside>
    )
}