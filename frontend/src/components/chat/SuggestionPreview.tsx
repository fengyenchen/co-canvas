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

      <button
        type="button"
        onClick={clearPendingSuggestion}
        className="mt-3 w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary/40"
      >
        取消
      </button>
    </section>
  )
}
