import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../types/canvas'

const handleClassName =
    'h-2.5! w-2.5! border-2! border-background! bg-primary!'

export function ConceptNode({
    data,
    selected,
}: NodeProps<CanvasNode>) {
    return (
        <div
            className={`min-w-40 rounded-xl border bg-background px-4 py-3 shadow-sm
            ${selected ? 'border-primary ring-2 ring-primary/15' : 'border-border'}`}
        >
            <Handle
                id="top"
                type="target"
                position={Position.Top}
                className={handleClassName}
            />

            <div className="font-semibold text-foreground">
                {data.title}
            </div>

            {data.content && (
                <div className="mt-1 text-sm text-foreground/65">
                    {data.content}
                </div>
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
