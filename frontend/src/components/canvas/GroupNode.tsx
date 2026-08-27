import { useEffect } from 'react'
import { useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Layers3 } from 'lucide-react'

import { useCanvasStore } from '../../stores/canvasStore'
import type { GroupCanvasNode } from '../../types/canvas'
import { getGroupNodeColor } from '../../utils/nodeColor'

export function GroupNode({ id, data, selected }: NodeProps<GroupCanvasNode>) {
    const updateNodeInternals = useUpdateNodeInternals()
    const toggleGroupCollapsed = useCanvasStore(
        (state) => state.toggleGroupCollapsed,
    )
    const memberCount = useCanvasStore(
        (state) => state.nodes.filter((node) => node.parentId === id).length,
    )
    const color = getGroupNodeColor(data.color)
    const collapsed = Boolean(data.collapsed)

    useEffect(() => {
        updateNodeInternals(id)
    }, [collapsed, id, updateNodeInternals])

    return (
        <div
            style={{
                width: collapsed ? 320 : data.width,
                height: collapsed ? 52 : data.height,
            }}
            className={`overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${color.backgroundClassName} ${color.borderClassName} ${
                selected
                    ? 'ring-2 ring-primary/20'
                    : ''
            }`}
        >
            <div
                className={`flex h-13 min-w-0 items-center gap-2 px-3 text-sm text-foreground/70 ${
                    collapsed ? '' : `border-b ${color.dividerClassName}`
                }`}
            >
                <Layers3
                    aria-hidden="true"
                    className={`size-4 shrink-0 ${color.accentClassName}`}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {data.title || '未命名群組'}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-foreground/50">
                    {memberCount} 個節點
                </span>
                <button
                    type="button"
                    aria-label={collapsed ? '展開群組' : '收合群組'}
                    aria-expanded={!collapsed}
                    title={collapsed ? '展開群組' : '收合群組'}
                    onClick={(event) => {
                        event.stopPropagation()
                        toggleGroupCollapsed(id)
                    }}
                    className="nodrag nopan flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    {collapsed ? (
                        <ChevronRight aria-hidden="true" className="size-4" />
                    ) : (
                        <ChevronDown aria-hidden="true" className="size-4" />
                    )}
                </button>
            </div>
        </div>
    )
}
