import { useState } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'

export function ChatPanel() {
  const [draft, setDraft] = useState('')

  const activeContextNodeId = useChatStore(
    (state) => state.activeContextNodeId,
  )
  const setActiveContextNodeId = useChatStore(
    (state) => state.setActiveContextNodeId,
  )

  const addMessage = useChatStore(
    (state) => state.addMessage,
  )

  const messages = useChatStore(
    (state) => state.messages,
  )

  const contextNode = useCanvasStore(
    (state) =>
      state.nodes.find(
        (node) => node.id === activeContextNodeId,
      ) ?? null,
  )

  const visibleMessages = messages.filter(
    (message) =>
      message.contextNodeId === activeContextNodeId,
  )

  function handleSend() {
    const content = draft.trim()

    if (!content || !activeContextNodeId) {
      return
    }

    addMessage({
      role: 'user',
      content,
      contextNodeId: activeContextNodeId,
    })

    setDraft('')
  }

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

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {visibleMessages.length === 0 ? (
          <div className="py-8 text-center text-sm text-foreground/50">
            輸入指令來延伸這個節點
          </div>
        ) : (
          visibleMessages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === 'user'
                  ? 'flex justify-end'
                  : 'flex justify-start'
              }
            >
              <div
                className={[
                  'max-w-[85%] whitespace-pre-wrap word-break rounded-xl px-3 py-2 text-sm',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-foreground',
                ].join(' ')}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border p-4">
        <label
          htmlFor="chat-message"
          className="mb-2 block text-sm text-foreground/70"
        >
          輸入訊息
        </label>

        <textarea
          id="chat-message"
          value={draft}
          onChange={(event) =>
            setDraft(event.target.value)
          }
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              handleSend()
            }
          }}
          rows={3}
          placeholder="想問什麼…"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim()}
          className="mt-2 w-full cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          送出
        </button>
      </div>
    </aside>
  )
}