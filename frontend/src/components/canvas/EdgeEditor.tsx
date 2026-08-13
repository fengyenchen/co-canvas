import { useState } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import type { CanvasEdge } from '../../types/canvas'

export function EdgeEditor() {
    const selectedNode = useCanvasStore(
        (state) => state.nodes.some((node) => node.selected),
    )
    const selectedEdge = useCanvasStore(
        (state) =>
            state.edges.find((edge) => edge.selected) ?? null,
    )
    if (!selectedEdge || selectedNode) {
        return null
    }

    return (
        <EdgeEditorForm
            key={`${selectedEdge.id}:${String(selectedEdge.label ?? '')}`}
            edge={selectedEdge}
        />
    )
}

function EdgeEditorForm({ edge }: { edge: CanvasEdge }) {
    const updateEdgeLabel = useCanvasStore(
        (state) => state.updateEdgeLabel,
    )
    const deleteEdge = useCanvasStore(
        (state) => state.deleteEdge,
    )
    const [label, setLabel] = useState(
        typeof edge.label === 'string' ? edge.label : '',
    )

    function saveLabel() {
        updateEdgeLabel(edge.id, label.trim())
    }

    return (
        <aside className="absolute right-4 top-4 z-10 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-background p-4 shadow-sm md:w-72 lg:w-80">
            <h2 className="mb-4 font-semibold text-foreground">
                連線設定
            </h2>

            <label className="block">
                <span className="mb-1 block text-sm text-foreground/70">
                    連線文字
                </span>

                <input
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    onBlur={saveLabel}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.currentTarget.blur()
                        }

                        if (event.key === 'Escape') {
                            setLabel(
                                typeof edge.label === 'string'
                                    ? edge.label
                                    : '',
                            )
                            event.currentTarget.blur()
                        }
                    }}
                    placeholder="例如：延伸、接著、包含"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
            </label>

            <button
                type="button"
                onClick={() => deleteEdge(edge.id)}
                className="mt-6 min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
            >
                刪除連線
            </button>
        </aside>
    )
}
