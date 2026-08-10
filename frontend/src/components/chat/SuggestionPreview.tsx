import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'

export function SuggestionPreview() {
  const activeContextNodeId = useChatStore(
    (state) => state.activeContextNodeId,
  )

  const pendingSuggestion = useChatStore(
    (state) => state.pendingSuggestion,
  )

  const clearPendingSuggestion = useChatStore(
    (state) => state.clearPendingSuggestion,
  )

  const applySuggestion = useCanvasStore(
    (state) => state.applySuggestion,
  )

  if (
    !pendingSuggestion ||
    pendingSuggestion.contextNodeId !== activeContextNodeId
  ) {
    return null
  }

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-3 text-sm font-medium text-foreground">
        建議節點
      </div>

      <div className="space-y-2">
        {pendingSuggestion.suggestion.nodes.map(
          (node) => (
            <article
              key={node.tempId}
              className="rounded-lg border border-border bg-background p-3"
            >
              <h3 className="text-sm font-medium text-foreground">
                {node.title}
              </h3>

              <p className="mt-1 text-xs leading-5 text-foreground/65">
                {node.content}
              </p>
            </article>
          ),
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={clearPendingSuggestion}
          className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary/40"
        >
          取消
        </button>

        <button
          type="button"
          onClick={() => {
            applySuggestion(pendingSuggestion)
            clearPendingSuggestion()
          }}
          className="flex-1 cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          加入畫布
        </button>
      </div>
    </section>
  )
}
