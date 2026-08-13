import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { sendChatMessage } from '../../api/chat'
import { generateSuggestion } from '../../api/generateSuggestion'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import { formatLatency } from '../../utils/formatLatency'
import { measureRequest } from '../../utils/measureRequest'
import { SuggestionPreview } from './SuggestionPreview'

type ChatPanelProps = {
  mobileHeightPercent: number
}

export function ChatPanel({
  mobileHeightPercent,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [neighborSelection, setNeighborSelection] = useState<{
    contextNodeId: string | null
    excludedNodeIds: Set<string>
  }>({
    contextNodeId: null,
    excludedNodeIds: new Set(),
  })
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

  const clearMessagesByContext = useChatStore(
    (state) => state.clearMessagesByContext,
  )

  const deleteMessage = useChatStore(
    (state) => state.deleteMessage,
  )

  const updateMessage = useChatStore(
    (state) => state.updateMessage,
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

  const neighborNodeIds = new Set(
    edges.flatMap((edge) => {
      if (edge.source === activeContextNodeId) {
        return [edge.target]
      }

      if (edge.target === activeContextNodeId) {
        return [edge.source]
      }

      return []
    }),
  )

  const contextNeighborNodes = nodes.filter((node) =>
    neighborNodeIds.has(node.id),
  )

  const excludedNeighborNodeIds =
    neighborSelection.contextNodeId === activeContextNodeId
      ? neighborSelection.excludedNodeIds
      : new Set<string>()

  const selectedContextNeighborNodes = contextNeighborNodes.filter(
    (node) => !excludedNeighborNodeIds.has(node.id),
  )

  function toggleNeighborNode(nodeId: string) {
    setNeighborSelection((selection) => {
      const excludedNodeIds =
        selection.contextNodeId === activeContextNodeId
          ? new Set(selection.excludedNodeIds)
          : new Set<string>()

      if (excludedNodeIds.has(nodeId)) {
        excludedNodeIds.delete(nodeId)
      } else {
        excludedNodeIds.add(nodeId)
      }

      return {
        contextNodeId: activeContextNodeId,
        excludedNodeIds,
      }
    })
  }

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

  async function requestChatResponse(
    content: string,
    excludedMessageId?: string,
  ) {
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

    const result = await measureRequest(() =>
      sendChatMessage({
        prompt: content,
        selectedNode: {
          id: contextNode.id,
          title: contextNode.data.title,
          content: contextNode.data.content,
        },
        neighborNodes: selectedContextNeighborNodes
          .map((node) => ({
            id: node.id,
            title: node.data.title,
            content: node.data.content,
          })),
        history: visibleMessages
          .filter((message) => message.id !== excludedMessageId)
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

    const result = await measureRequest(() =>
      generateSuggestion({
        prompt: `請將以下內容整理成適合畫布的節點：\n\n${sourceContent}`,
        selectedNode: {
          id: contextNode.id,
          title: contextNode.data.title,
          content: contextNode.data.content,
        },
        neighborNodes: selectedContextNeighborNodes
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

  function handleResendMessage(messageId: string) {
    const content = editingContent.trim()

    if (!content || isGenerating) {
      return
    }

    updateMessage(messageId, content)
    setEditingMessageId(null)
    setEditingContent('')
    void requestChatResponse(content, messageId)
  }

  if (!contextNode) {
    return null
  }

  const mobileHeightStyle = {
    '--mobile-chat-height': `${mobileHeightPercent}%`,
  } as CSSProperties

  return (
    <aside
      style={mobileHeightStyle}
      className="flex h-[var(--mobile-chat-height)] w-full max-w-full shrink-0 flex-col overflow-hidden border-b border-border bg-background lg:h-full lg:w-100 lg:border-b-0 lg:border-r"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border p-4">
        <h2 className="font-semibold text-foreground">
          對話
          <span className="ml-1 text-xs text-foreground/60 lg:hidden">
            ({contextNode.data.title})
          </span>
        </h2>

        <div className="flex items-center gap-1">
          {visibleMessages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    '確定要清除這個節點的所有對話嗎？',
                  )
                ) {
                  clearMessagesByContext(contextNode.id)
                }
              }}
              className="min-h-11 cursor-pointer rounded-md px-3 text-sm text-foreground/60 transition hover:bg-red-50 hover:text-red-600"
            >
              清除此串
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveContextNodeId(null)}
            aria-label="關閉對話"
            className="min-h-11 min-w-11 cursor-pointer rounded-md text-foreground/60 transition hover:bg-primary/10 hover:text-foreground"
          >
            ×
          </button>
        </div>
      </header>

      <details className="group shrink-0 border-b border-border bg-primary/3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm text-foreground/70 transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30">
          <span>
            AI 上下文：目前節點
            {contextNeighborNodes.length > 0
              ? `＋${selectedContextNeighborNodes.length}/${contextNeighborNodes.length} 個相鄰節點`
              : '（無相鄰節點）'}
          </span>
          <span
            aria-hidden="true"
            className="text-xs transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </summary>

        <div className="space-y-2 px-4 pb-3 text-sm">
          <div>
            <div className="text-xs text-foreground/50">目前節點</div>
            <div className="mt-0.5 font-medium text-foreground">
              {contextNode.data.title}
            </div>
          </div>

          {contextNeighborNodes.length > 0 && (
            <div>
              <div className="text-xs text-foreground/50">
                選擇一層相鄰節點
              </div>
              <ul className="mt-1 space-y-1">
                {contextNeighborNodes.map((node) => (
                  <li key={node.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-foreground/70 transition hover:bg-primary/5">
                      <input
                        type="checkbox"
                        checked={!excludedNeighborNodeIds.has(node.id)}
                        onChange={() => toggleNeighborNode(node.id)}
                        className="size-5 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 wrap-break-word">
                        {node.data.title}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

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
                {editingMessageId === message.id ? (
                  <div className="rounded-xl border border-primary/30 bg-background p-2 shadow-sm">
                    <label
                      htmlFor={`edit-message-${message.id}`}
                      className="sr-only"
                    >
                      編輯訊息
                    </label>
                    <textarea
                      id={`edit-message-${message.id}`}
                      value={editingContent}
                      onChange={(event) =>
                        setEditingContent(event.target.value)
                      }
                      rows={3}
                      autoFocus
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(null)
                          setEditingContent('')
                        }}
                        className="min-h-11 cursor-pointer rounded-md px-3 text-xs text-foreground/60 transition hover:bg-primary/10"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={!editingContent.trim() || isGenerating}
                        onClick={() => handleResendMessage(message.id)}
                        className="min-h-11 cursor-pointer rounded-md bg-primary px-3 text-xs text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        重新傳送
                      </button>
                    </div>
                  </div>
                ) : (
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
                )}

                {message.role === 'ai' && (
                  <div className="mt-1 flex min-h-11 items-center gap-1">
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

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('確定要刪除此訊息嗎？')) {
                          deleteMessage(message.id)
                        }
                      }}
                      className="min-h-11 cursor-pointer rounded-md px-2 text-xs text-foreground/50 transition hover:bg-red-50 hover:text-red-600"
                    >
                      刪除
                    </button>
                  </div>
                )}

                {message.role === 'user' && editingMessageId !== message.id && (
                  <div className="mt-1 flex min-h-11 items-center justify-end gap-1">
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => {
                        setEditingMessageId(message.id)
                        setEditingContent(message.content)
                      }}
                      className="min-h-11 cursor-pointer rounded-md px-2 text-xs text-foreground/50 transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('確定要刪除此訊息嗎？')) {
                          deleteMessage(message.id)
                        }
                      }}
                      className="min-h-11 cursor-pointer rounded-md px-2 text-xs text-foreground/50 transition hover:bg-red-50 hover:text-red-600"
                    >
                      刪除
                    </button>
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
