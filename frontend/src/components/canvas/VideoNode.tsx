import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Film } from 'lucide-react'
import type { VideoCanvasNode } from '../../types/canvas'

const handleClassName =
    'h-2.5! w-2.5! border-2! border-background! bg-primary!'

export function VideoNode({ data, selected }: NodeProps<VideoCanvasNode>) {
    return (
        <div
            className={`w-64 rounded-xl border bg-background px-4 py-3 shadow-sm ${
                selected
                    ? 'border-primary ring-2 ring-primary/15'
                    : 'border-border'
            }`}
        >
            <Handle
                id="top"
                type="target"
                position={Position.Top}
                className={handleClassName}
            />

            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Film aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                    <div className="wrap-break-word font-semibold text-foreground">
                        {data.title}
                    </div>
                    {data.content && (
                        <div className="mt-1 wrap-break-word text-sm text-foreground/65">
                            {data.content}
                        </div>
                    )}
                </div>
            </div>

            <Handle
                id="bottom"
                type="source"
                position={Position.Bottom}
                className={handleClassName}
            />
        </div>
    )
}
