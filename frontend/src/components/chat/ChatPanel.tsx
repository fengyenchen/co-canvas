import { useEffect, useRef, useState } from 'react'
import { sendChatMessage } from '../../api/chat'
import { generateSuggestion } from '../../api/generateSuggestion'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import { formatLatency } from '../../utils/formatLatency'
import { measureRequest } from '../../utils/measureRequest'
import { SuggestionPreview } from './SuggestionPreview'

export function ChatPanel() {
  const [draft, setDraft] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousContextNodeIdRef = useRef<string | null>(null)
  const previousMessageCountRef = useRef(0)

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

  const generationMode = useChatStore(
    (state) => state.generationMode,
  )

  const setGenerationMode = useChatStore(
    (state) => state.setGenerationMode,
  )

  const isGenerating = generationMode !== null

  const setPendingSuggestion = useChatStore(
    (state) => state.setPendingSuggestion,
  )

  const clearPendingSuggestion = useChatStore(
    (state) => state.clearPendingSuggestion,
  )

  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)

  const contextNode = nodes.find(
    (node) => node.id === activeContextNodeId,
  ) ?? null

  const visibleMessages = messages.filter(
    (message) =>
      message.contextNodeId === activeContextNodeId,
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [activeContextNodeId, generationMode, visibleMessages.length])

  useEffect(() => {
    const previousContextNodeId = previousContextNodeIdRef.current
    const previousMessageCount = previousMessageCountRef.current

    previousContextNodeIdRef.current = activeContextNodeId
    previousMessageCountRef.current = visibleMessages.length

    if (
      previousContextNodeId !== activeContextNodeId ||
      visibleMessages.length <= previousMessageCount ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    const newestMessage = visibleMessages.at(-1)
    const messageElements = messagesContainerRef.current
      ?.querySelectorAll<HTMLElement>('[data-chat-message]')
    const messageElement = messageElements?.item(
      (messageElements.length ?? 0) - 1,
    )

    if (!newestMessage || !messageElement) {
      return
    }

    const direction = newestMessage.role === 'user' ? 14 : -14

    messageElement.animate(
      [
        {
          opacity: 0,
          transform: `translate3d(${direction}px, 8px, 0) scale(0.94)`,
        },
        {
          opacity: 1,
          transform: `translate3d(${-direction * 0.12}px, -2px, 0) scale(1.025)`,
          offset: 0.72,
        },
        {
          opacity: 1,
          transform: 'translate3d(0, 0, 0) scale(1)',
        },
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    )
  }, [activeContextNodeId, visibleMessages])

  async function requestChatResponse(content: string) {
    if (
      !content ||
      !activeContextNodeId ||
      !contextNode ||
      isGenerating
    ) {
      return
    }

    const contextNodeId = activeContextNodeId

    clearPendingSuggestion()
    setGenerationMode('chat')

    const neighborNodeIds = new Set(
      edges.flatMap((edge) => {
        if (edge.source === contextNodeId) {
          return [edge.target]
        }

        if (edge.target === contextNodeId) {
          return [edge.source]
        }

        return []
      }),
    )

    const result = await measureRequest(() =>
      sendChatMessage({
        prompt: content,
        selectedNode: {
          id: contextNode.id,
          title: contextNode.data.title,
          content: contextNode.data.content,
        },
        neighborNodes: nodes
          .filter((node) => neighborNodeIds.has(node.id))
          .map((node) => ({
            id: node.id,
            title: node.data.title,
            content: node.data.content,
          })),
        history: visibleMessages
          .slice(-30)
          .map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
      }),
    )

    if (result.ok) {
      addMessage({
        role: 'ai',
        content: result.data,
        contextNodeId,
        canGenerateNodes: true,
        latencyMs: result.latencyMs,
      })
    } else {
      addMessage({
        role: 'ai',
        content: 'AI 回覆失敗，請確認後端已啟動後再試一次。',
        contextNodeId,
        latencyMs: result.latencyMs,
      })
    }

    setGenerationMode(null)
  }

  async function requestSuggestion(sourceContent: string) {
    if (!activeContextNodeId || !contextNode || isGenerating) {
      return
    }

    const contextNodeId = activeContextNodeId

    clearPendingSuggestion()
    setGenerationMode('suggestion')

    const neighborNodeIds = new Set(
      edges.flatMap((edge) => {
        if (edge.source === contextNodeId) {
          return [edge.target]
        }

        if (edge.target === contextNodeId) {
          return [edge.source]
        }

        return []
      }),
    )

    const result = await measureRequest(() =>
      generateSuggestion({
        prompt: `請將以下內容整理成適合畫布的節點：\n\n${sourceContent}`,
        selectedNode: {
          id: contextNode.id,
          title: contextNode.data.title,
          content: contextNode.data.content,
        },
        neighborNodes: nodes
          .filter((node) => neighborNodeIds.has(node.id))
          .map((node) => ({
            id: node.id,
            title: node.data.title,
            content: node.data.content,
          })),
      }),
    )

    if (result.ok) {
      setPendingSuggestion({
        contextNodeId,
        prompt: sourceContent,
        suggestion: result.data,
        latencyMs: result.latencyMs,
      })
    } else {
      addMessage({
        role: 'ai',
        content: '產生節點失敗，請稍後再試一次。',
        contextNodeId,
        latencyMs: result.latencyMs,
      })
    }

    setGenerationMode(null)
  }

  function handleSend() {
    const content = draft.trim()

    if (
      !content ||
      !activeContextNodeId ||
      !contextNode ||
      isGenerating
    ) {
      return
    }

    addMessage({
      role: 'user',
      content,
      contextNodeId: activeContextNodeId,
    })

    setDraft('')
    void requestChatResponse(content)
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

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {visibleMessages.length === 0 ? (
          <div className="py-8 text-center text-sm text-foreground/50">
            輸入指令來延伸這個節點
          </div>
        ) : (
          visibleMessages.map((message) => (
            <div
              key={message.id}
              data-chat-message
              className={
                message.role === 'user'
                  ? 'flex justify-end'
                  : 'flex justify-start'
              }
            >
              <div className="max-w-[85%]">
                <div
                  className={[
                    'whitespace-pre-wrap wrap-break-word rounded-xl px-3 py-2 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-background text-foreground',
                  ].join(' ')}
                >
                  {message.content}
                </div>

                {message.role === 'ai' && (
                  <div className="mt-1 flex min-h-7 items-center gap-1">
                    {message.latencyMs !== undefined && (
                      <span className="px-2 text-xs text-foreground/45">
                        回應 {formatLatency(message.latencyMs)}
                      </span>
                    )}

                    {message.canGenerateNodes && (
                      <button
                        type="button"
                        onClick={() => {
                          void requestSuggestion(message.content)
                        }}
                        disabled={isGenerating}
                        className="cursor-pointer rounded-md px-2 py-1 text-xs text-foreground/60 transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        產生節點
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {generationMode === 'chat' && (
          <div className="flex justify-start">
            <div
              role="status"
              aria-label="AI 正在回覆"
              className="rounded-xl border border-border bg-background px-3 py-3 text-foreground/60"
            >
              <span aria-hidden="true" className="flex items-center gap-1">
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
              </span>
            </div>
          </div>
        )}

        {generationMode === 'suggestion' && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground/60">
            <span className="animate-pulse">正在整理節點…</span>
          </div>
        )}

        <SuggestionPreview
          onRegenerate={(prompt) => {
            void requestSuggestion(prompt)
          }}
        />

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
