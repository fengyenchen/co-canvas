import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'

export function ChatPanel() {
  const activeContextNodeId = useChatStore(
    (state) => state.activeContextNodeId,
  )
  const setActiveContextNodeId = useChatStore(
    (state) => state.setActiveContextNodeId,
  )

  const contextNode = useCanvasStore(
    (state) =>
      state.nodes.find(
        (node) => node.id === activeContextNodeId,
      ) ?? null,
  )

  if (!contextNode) {
    return null
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-border bg-background">
      <header className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-foreground">
          對話
        </h2>

        <button
          type="button"
          onClick={() => setActiveContextNodeId(null)}
          aria-label="關閉對話"
          className="cursor-pointer rounded-md px-2 py-1 text-foreground/60 transition hover:bg-primary/10 hover:text-foreground"
        >
          ×
        </button>
      </header>

      <div className="border-b border-border p-4">
        <div className="text-xs text-foreground/60">
          正在延伸
        </div>

        <div className="mt-1 font-medium text-foreground">
          {contextNode.data.title}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-foreground/50">
        下一步將在這裡加入對話訊息
      </div>
    </aside>
  )
}