import type { NodeProps } from '@xyflow/react'
import { Layers3 } from 'lucide-react'

import { useCanvasStore } from '../../stores/canvasStore'
import type { GroupCanvasNode } from '../../types/canvas'

export function GroupNode({ id, data, selected }: NodeProps<GroupCanvasNode>) {
    const memberCount = useCanvasStore(
        (state) => state.nodes.filter((node) => node.parentId === id).length,
    )

    return (
        <div
            style={{ width: data.width, height: data.height }}
            className={`rounded-2xl border-2 border-dashed bg-primary/3 transition-colors ${
                selected
                    ? 'border-primary bg-primary/6 ring-2 ring-primary/10'
                    : 'border-primary/25'
            }`}
        >
            <div className="flex h-13 items-center gap-2 border-b border-primary/15 px-4 text-sm text-foreground/70">
                <Layers3 aria-hidden="true" className="size-4 text-primary" />
                <span className="max-w-60 truncate font-medium text-foreground">
                    {data.title || '未命名群組'}
                </span>
                <span className="text-xs text-foreground/45">
                    {memberCount} 個節點
                </span>
            </div>
        </div>
    )
}
