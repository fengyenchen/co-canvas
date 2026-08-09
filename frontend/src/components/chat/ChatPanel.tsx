import { useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'

export function ChatPanel() {
  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  const isGenerating = useChatStore(
    (state) => state.isGenerating,
  )

  const setIsGenerating = useChatStore(
    (state) => state.setIsGenerating,
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [activeContextNodeId, isGenerating, visibleMessages.length])

  function handleSend() {
    const content = draft.trim()

    if (!content || !activeContextNodeId || isGenerating) {
      return
    }

    addMessage({
      role: 'user',
      content,
      contextNodeId: activeContextNodeId,
    })

    setDraft('')

    const contextNodeId = activeContextNodeId

    setIsGenerating(true)

    window.setTimeout(() => {
      addMessage({
        role: 'ai',
        content: `我收到你的指令：「${content}」`,
        contextNodeId,
      })

      setIsGenerating(false)
    }, 800)
  }

  if (!contextNode) {
    return null
  }

  return (
    <aside className="flex h-[55%] w-full max-w-full shrink-0 flex-col overflow-hidden border-b border-border bg-background lg:h-full lg:w-100 lg:border-b-0 lg:border-r">
      <header className="flex shrink-0 items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-foreground">
          對話
          <span className="ml-1 text-xs text-foreground/60 lg:hidden">
            ({contextNode.data.title})
          </span>
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

      <div className="hidden shrink-0 border-b border-border p-4 lg:block">
        <div className="text-xs text-foreground/60">
          正在延伸
        </div>

        <div className="mt-1 font-medium text-foreground">
          {contextNode.data.title}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
                  'max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-xl px-3 py-2 text-sm',
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

        {isGenerating && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground/60">
              <span className="block animate-pulse">...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <label
          htmlFor="chat-message"
          className="mb-2 hidden text-sm text-foreground/70 lg:block"
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
          rows={2}
          placeholder="想問什麼…"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim()  || isGenerating}
          className="mt-2 w-full cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          送出
        </button>
      </div>
    </aside>
  )
}
