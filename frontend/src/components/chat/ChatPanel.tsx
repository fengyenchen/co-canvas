import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { sendChatMessage } from '../../api/chat'
import { getGeminiCredential } from '../../api/aiCredentials'
import {
  ApiRequestError,
  getAiErrorMessage,
  isRetryableAiError,
} from '../../api/errors'
import { generateSuggestion } from '../../api/generateSuggestion'
import { getHealth } from '../../api/health'
import type { AiMode } from '../../api/health'
import type { AiFallbackReason } from '../../types/ai'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import { formatLatency } from '../../utils/formatLatency'
import { measureRequest } from '../../utils/measureRequest'
import { SuggestionPreview } from './SuggestionPreview'

type ChatPanelProps = {
  mobileHeightPercent: number
  isReadOnly?: boolean
  projectId?: string
  aiSettingsRevision?: number
}

export function ChatPanel({
  mobileHeightPercent,
  isReadOnly = false,
  projectId,
  aiSettingsRevision = 0,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [aiMode, setAiMode] = useState<AiMode | 'offline'>('offline')
  const [aiFallbackReason, setAiFallbackReason] =
    useState<AiFallbackReason | null>(null)
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

  useEffect(() => {
    let isCurrent = true

    async function loadAiMode() {
      try {
        if (projectId && projectId !== 'local') {
          const credential = await getGeminiCredential()

          if (!isCurrent) {
            return
          }

          if (!credential.configured) {
            setAiMode('mock')
            setAiFallbackReason('missing_key')
            return
          }

          if (credential.status === 'invalid') {
            setAiMode('mock')
            setAiFallbackReason('invalid_key')
            return
          }

          setAiMode('gemini')
          setAiFallbackReason(null)
          return
        }

        const health = await getHealth()

        if (isCurrent) {
          setAiMode(health.aiMode)
          setAiFallbackReason(
            health.aiMode === 'mock' ? 'configured_mock' : null,
          )
        }
      } catch (error) {
        if (!isCurrent) {
          return
        }

        if (error instanceof ApiRequestError && error.status === 401) {
          setAiMode('mock')
          setAiFallbackReason('unauthenticated')
          return
        }

        setAiMode('offline')
        setAiFallbackReason(null)
      }
    }

    void loadAiMode()

    return () => {
      isCurrent = false
    }
  }, [aiSettingsRevision, projectId])

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
    excludedMessageIds: string[] = [],
  ) {
    if (
      !content ||
      isReadOnly ||
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
        projectId,
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
          .filter((message) => !excludedMessageIds.includes(message.id))
          .slice(-30)
          .map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
      }),
    )

    const contextStillExists = useCanvasStore
      .getState()
      .nodes.some((node) => node.id === contextNodeId)

    if (!contextStillExists) {
      setGenerationMode(null)
      return
    }

    if (result.ok) {
      setAiMode(result.data.aiMode)
      setAiFallbackReason(result.data.fallbackReason)
      addMessage({
        role: 'ai',
        content: result.data.message,
        contextNodeId,
        canGenerateNodes: true,
        latencyMs: result.latencyMs,
      })
    } else {
      addMessage({
        role: 'ai',
        content: getAiErrorMessage(result.error, 'chat'),
        contextNodeId,
        latencyMs: result.latencyMs,
        isError: true,
        retryAction: isRetryableAiError(result.error) ? 'chat' : undefined,
        retryContent: isRetryableAiError(result.error) ? content : undefined,
      })
    }

    setGenerationMode(null)
  }

  async function requestSuggestion(sourceContent: string) {
    if (
      isReadOnly ||
      !activeContextNodeId ||
      !contextNode ||
      isGenerating
    ) {
      return
    }

    const contextNodeId = activeContextNodeId

    clearPendingSuggestion()
    setGenerationMode('suggestion')

    const result = await measureRequest(() =>
      generateSuggestion({
        projectId,
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

    const contextStillExists = useCanvasStore
      .getState()
      .nodes.some((node) => node.id === contextNodeId)

    if (!contextStillExists) {
      setGenerationMode(null)
      return
    }

    if (result.ok) {
      setAiMode(result.data.aiMode)
      setAiFallbackReason(result.data.fallbackReason)
      setPendingSuggestion({
        contextNodeId,
        prompt: sourceContent,
        suggestion: result.data.suggestion,
        latencyMs: result.latencyMs,
      })
    } else {
      addMessage({
        role: 'ai',
        content: getAiErrorMessage(result.error, 'suggestion'),
        contextNodeId,
        latencyMs: result.latencyMs,
        isError: true,
        retryAction: isRetryableAiError(result.error)
          ? 'suggestion'
          : undefined,
        retryContent: isRetryableAiError(result.error)
          ? sourceContent
          : undefined,
      })
    }

    setGenerationMode(null)
  }

  function handleSend() {
    const content = draft.trim()

    if (
      !content ||
      isReadOnly ||
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

    if (!content || isReadOnly || isGenerating) {
      return
    }

    updateMessage(messageId, content)
    setEditingMessageId(null)
    setEditingContent('')
    void requestChatResponse(content, [messageId])
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2
            title={contextNode.data.title}
            className="min-w-0 truncate font-semibold text-foreground"
          >
            {contextNode.data.title}
          </h2>

          <details className="group relative shrink-0">
            <summary
              className={[
                'flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                aiMode === 'gemini'
                  ? 'border-primary/20 bg-primary/5 text-primary'
                  : aiMode === 'mock'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-red-200 bg-red-50 text-red-600',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'size-2 rounded-full',
                  aiMode === 'gemini'
                    ? 'bg-primary'
                    : aiMode === 'mock'
                      ? 'bg-amber-500'
                      : 'bg-red-500',
                ].join(' ')}
              />
              {aiMode === 'gemini'
                ? 'Gemini'
                : aiMode === 'mock'
                  ? 'Mock'
                  : '離線'}
            </summary>

            <div className="absolute left-0 top-full z-40 mt-2 w-56 rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground/70 shadow-md">
              {aiMode === 'gemini' && '目前使用 Gemini 產生回覆與節點。'}
              {aiMode === 'mock' && '目前使用固定測試資料，不會呼叫 Gemini。'}
              {aiMode === 'offline' && '無法連線後端，請確認服務是否已啟動。'}
            </div>
          </details>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!isReadOnly && visibleMessages.length > 0 && (
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

      {aiMode === 'mock' && aiFallbackReason && (
        <p
          role="status"
          className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800"
        >
          {aiFallbackReason === 'quota_exceeded'
            ? 'Gemini 額度不足，本次已改用 Mock。'
            : aiFallbackReason === 'invalid_key'
              ? 'Gemini API Key 無效，本次已改用 Mock。'
              : aiFallbackReason === 'missing_key'
                ? '尚未設定 Gemini API Key，目前使用 Mock。'
                : aiFallbackReason === 'unauthenticated'
                  ? '登入後設定 Gemini API Key，即可使用 Gemini。'
                  : '系統目前設定為 Mock 模式。'}
        </p>
      )}

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
                        disabled={isReadOnly}
                        onChange={() => toggleNeighborNode(node.id)}
                        className="size-5 shrink-0 accent-primary disabled:opacity-50"
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
            {isReadOnly ? '這個節點尚無對話' : '輸入指令來延伸這個節點'}
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
                {!isReadOnly && editingMessageId === message.id ? (
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
                    role={message.isError ? 'alert' : undefined}
                    className={[
                      'whitespace-pre-wrap wrap-break-word rounded-xl px-3 py-2 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.isError
                          ? 'border border-red-200 bg-red-50 text-red-700'
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

                    {!isReadOnly && message.canGenerateNodes && (
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

                    {!isReadOnly && message.retryAction && message.retryContent && (
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => {
                          const retryContent = message.retryContent

                          if (!retryContent) {
                            return
                          }

                          deleteMessage(message.id)

                          if (message.retryAction === 'suggestion') {
                            void requestSuggestion(retryContent)
                            return
                          }

                          const messageIndex = visibleMessages.findIndex(
                            (candidate) => candidate.id === message.id,
                          )
                          const sourceMessage = visibleMessages
                            .slice(0, messageIndex)
                            .findLast((candidate) => candidate.role === 'user')

                          void requestChatResponse(
                            retryContent,
                            [message.id, sourceMessage?.id]
                              .filter((id): id is string => Boolean(id)),
                          )
                        }}
                        className="min-h-11 cursor-pointer rounded-md px-2 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {message.retryAction === 'chat'
                          ? '重新傳送'
                          : '重新產生節點'}
                      </button>
                    )}

                    {!isReadOnly && (
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
                    )}
                  </div>
                )}

                {!isReadOnly &&
                  message.role === 'user' &&
                  editingMessageId !== message.id && (
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

        {!isReadOnly && (
          <SuggestionPreview
            onRegenerate={(prompt) => {
              void requestSuggestion(prompt)
            }}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {isReadOnly ? (
        <div className="shrink-0 border-t border-border p-4">
          <p
            role="status"
            className="rounded-lg border border-border bg-canvas px-3 py-3 text-center text-sm text-foreground/65"
          >
            你目前只有檢視權限
          </p>
        </div>
      ) : (
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
      )}
    </aside>
  )
}
