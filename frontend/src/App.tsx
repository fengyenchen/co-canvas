import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Canvas } from './components/canvas/Canvas'
import { ChatPanel } from './components/chat/ChatPanel'
import { useChatStore } from './stores/chatStore'
import './index.css'

const MIN_CHAT_HEIGHT_PERCENT = 30
const MAX_CHAT_HEIGHT_PERCENT = 75
const DEFAULT_CHAT_HEIGHT_PERCENT = 55

function clampChatHeight(value: number): number {
  return Math.min(
    MAX_CHAT_HEIGHT_PERCENT,
    Math.max(MIN_CHAT_HEIGHT_PERCENT, value),
  )
}

function App() {
  const layoutRef = useRef<HTMLDivElement>(null)
  const resizingPointerIdRef = useRef<number | null>(null)
  const [mobileChatHeight, setMobileChatHeight] = useState(
    DEFAULT_CHAT_HEIGHT_PERCENT,
  )
  const activeContextNodeId = useChatStore(
    (state) => state.activeContextNodeId,
  )

  function updateMobileChatHeight(clientY: number) {
    const layoutRect = layoutRef.current?.getBoundingClientRect()

    if (!layoutRect || layoutRect.height === 0) {
      return
    }

    const nextHeight =
      ((clientY - layoutRect.top) / layoutRect.height) * 100

    setMobileChatHeight(clampChatHeight(nextHeight))
  }

  function handleResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    resizingPointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    updateMobileChatHeight(event.clientY)
  }

  function handleResizeMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (resizingPointerIdRef.current !== event.pointerId) {
      return
    }

    updateMobileChatHeight(event.clientY)
  }

  function handleResizeEnd(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (resizingPointerIdRef.current !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resizingPointerIdRef.current = null
  }

  return (
    <div
      ref={layoutRef}
      className="flex h-screen w-screen flex-col overflow-hidden bg-background lg:flex-row"
    >
      <ChatPanel mobileHeightPercent={mobileChatHeight} />

      {activeContextNodeId && (
        <div className="relative z-30 h-0 shrink-0 lg:hidden">
          <button
            type="button"
            role="separator"
            aria-label="調整對話與畫布高度"
            aria-orientation="horizontal"
            aria-valuemin={MIN_CHAT_HEIGHT_PERCENT}
            aria-valuemax={MAX_CHAT_HEIGHT_PERCENT}
            aria-valuenow={Math.round(mobileChatHeight)}
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setMobileChatHeight((height) =>
                  clampChatHeight(height - 5),
                )
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setMobileChatHeight((height) =>
                  clampChatHeight(height + 5),
                )
              }
            }}
            className="group absolute left-0 top-1/2 flex h-11 w-full -translate-y-1/2 touch-none cursor-row-resize items-center justify-center focus-visible:outline-none"
          >
            <span className="h-1.5 w-12 rounded-full border border-border bg-background shadow-sm transition group-hover:border-primary/40 group-hover:bg-primary/10 group-focus-visible:border-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/20" />
          </button>
        </div>
      )}

      <Canvas />
    </div>
  )
}

export default App
