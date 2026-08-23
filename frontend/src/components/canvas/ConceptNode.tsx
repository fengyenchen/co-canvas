import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Play } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import type { ConceptCanvasNode } from '../../types/canvas'

const handleClassName =
    'h-2.5! w-2.5! border-2! border-background! bg-primary!'

export function ConceptNode({
    id,
    data,
    selected,
}: NodeProps<ConceptCanvasNode>) {
    const linkedVideoNodeId = useCanvasStore((state) => {
        const videoNodeIds = new Set(
            state.nodes
                .filter((node) => node.type === 'video')
                .map((node) => node.id),
        )
        return state.edges.find(
            (edge) => edge.target === id && videoNodeIds.has(edge.source),
        )?.source
    })
    const requestVideoSeek = useCanvasStore(
        (state) => state.requestVideoSeek,
    )
    const hasTimeRange =
        data.startTimeMs !== undefined && data.endTimeMs !== undefined

    return (
        <div
            className={`w-64 rounded-xl border bg-background px-4 py-3 shadow-sm
            ${selected ? 'border-primary ring-2 ring-primary/15' : 'border-border'}`}
        >
            <Handle
                id="top"
                type="target"
                position={Position.Top}
                className={handleClassName}
            />

            <div className="wrap-break-word font-semibold text-foreground">
                {data.title}
            </div>

            {data.content && (
                <div className="mt-1 wrap-break-word text-sm text-foreground/65">
                    {data.content}
                </div>
            )}

            {hasTimeRange && linkedVideoNodeId && (
                <button
                    type="button"
                    aria-label={`從 ${data.startTimeMs! / 1000} 秒播放影片`}
                    onClick={(event) => {
                        event.stopPropagation()
                        requestVideoSeek(linkedVideoNodeId, data.startTimeMs!)
                    }}
                    className="nodrag nopan mt-3 flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary/8 px-3 text-xs font-medium text-primary transition hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                    <Play aria-hidden="true" className="size-3.5 fill-current" />
                    {data.startTimeMs! / 1000}–{data.endTimeMs! / 1000} 秒
                </button>
            )}

            <Handle
                id="bottom"
                type="source"
                position={Position.Bottom}
                className={handleClassName}
            />
        </div>
    )
}
