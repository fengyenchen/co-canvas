import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import { formatLatency } from '../../utils/formatLatency'

type SuggestionPreviewProps = {
  onRegenerate: (prompt: string) => void
}

export function SuggestionPreview({
  onRegenerate,
}: SuggestionPreviewProps) {
  const activeContextNodeId = useChatStore(
    (state) => state.activeContextNodeId,
  )

  const pendingSuggestion = useChatStore(
    (state) => state.pendingSuggestion,
  )

  const clearPendingSuggestion = useChatStore(
    (state) => state.clearPendingSuggestion,
  )

  const updatePendingSuggestionNode = useChatStore(
    (state) => state.updatePendingSuggestionNode,
  )

  const recordSuggestionDecision = useChatStore(
    (state) => state.recordSuggestionDecision,
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

  const hasEmptyTitle = pendingSuggestion.suggestion.nodes.some(
    (node) => !node.title.trim(),
  )

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">
          建議節點
        </div>

        <div className="text-xs text-foreground/45">
          生成 {formatLatency(pendingSuggestion.latencyMs)}
        </div>
      </div>

      <div className="space-y-2">
        {pendingSuggestion.suggestion.nodes.map(
          (node) => (
            <article
              key={node.tempId}
              className="rounded-lg border border-border bg-background p-3"
            >
              <label className="block">
                <span className="sr-only">建議節點標題</span>
                <input
                  type="text"
                  value={node.title}
                  onChange={(event) =>
                    updatePendingSuggestionNode(node.tempId, {
                      title: event.target.value,
                    })
                  }
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground outline-none transition hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="mt-1 block">
                <span className="sr-only">建議節點內容</span>
                <textarea
                  value={node.content}
                  rows={2}
                  onChange={(event) =>
                    updatePendingSuggestionNode(node.tempId, {
                      content: event.target.value,
                    })
                  }
                  className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-xs leading-5 text-foreground/65 outline-none transition hover:border-border focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </article>
          ),
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            recordSuggestionDecision('rejected')
            clearPendingSuggestion()
          }}
          className="flex-1 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary/40"
        >
          取消
        </button>

        <button
          type="button"
          onClick={() => {
            recordSuggestionDecision('regenerated')
            onRegenerate(pendingSuggestion.prompt)
          }}
          className="flex-1 cursor-pointer rounded-lg border border-primary/30 px-3 py-2 text-sm text-primary transition hover:bg-primary/10"
        >
          重新生成
        </button>

        <button
          type="button"
          disabled={hasEmptyTitle}
          onClick={() => {
            recordSuggestionDecision('accepted')
            applySuggestion(pendingSuggestion)
            clearPendingSuggestion()
          }}
          className="flex-1 cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          加入畫布
        </button>
      </div>
    </section>
  )
}
