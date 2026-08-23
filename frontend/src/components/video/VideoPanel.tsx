import { Link, Video } from 'lucide-react'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import type { CanvasNode, VideoCanvasNode } from '../../types/canvas'

type VideoPanelProps = {
  isReadOnly?: boolean
}

function isVideoNode(node: CanvasNode): node is VideoCanvasNode {
  return node.type === 'video'
}

function validateVideoUrl(value: string): string | null {
  if (!value) return null

  try {
    const url = new URL(value)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '影片網址必須使用 http 或 https。'
    }

    if (url.hostname === 'drive.google.com' && url.pathname.includes('/file/')) {
      return 'Google Drive 檢視連結無法同步播放時間，請改用可直接播放的影片網址。'
    }

    return null
  } catch {
    return '請輸入完整的影片網址。'
  }
}

function VideoNodeEditor({
  node,
  isReadOnly,
}: {
  node: VideoCanvasNode
  isReadOnly: boolean
}) {
  const updateNode = useCanvasStore((state) => state.updateNode)
  const updateVideoNode = useCanvasStore((state) => state.updateVideoNode)
  const deleteNode = useCanvasStore((state) => state.deleteNode)
  const deleteBranch = useCanvasStore((state) => state.deleteBranch)
  const activeContextNodeId = useChatStore((state) => state.activeContextNodeId)
  const setActiveContextNodeId = useChatStore(
    (state) => state.setActiveContextNodeId,
  )
  const [draftUrl, setDraftUrl] = useState(node.data.source)
  const [formError, setFormError] = useState<string | null>(null)
  const [failedSource, setFailedSource] = useState<string | null>(null)

  function clearMissingActiveContext() {
    if (
      activeContextNodeId &&
      !useCanvasStore
        .getState()
        .nodes.some((candidate) => candidate.id === activeContextNodeId)
    ) {
      setActiveContextNodeId(null)
    }
  }

  function saveSource() {
    const source = draftUrl.trim()
    const error = validateVideoUrl(source)

    if (error) {
      setFormError(error)
      return
    }

    updateVideoNode(node.id, {
      source,
      durationMs: undefined,
    })
    setFormError(null)
    setFailedSource(null)
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const durationMs = Math.round(event.currentTarget.duration * 1000)

    if (
      Number.isFinite(durationMs) &&
      durationMs > 0 &&
      durationMs !== node.data.durationMs
    ) {
      updateVideoNode(node.id, { durationMs })
    }
  }

  return (
    <aside
      aria-labelledby="video-node-editor-title"
      className="absolute right-4 top-18 z-20 max-h-[calc(100%-5.5rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-background p-4 shadow-sm md:top-4 md:max-h-[calc(100%-2rem)] lg:w-96"
    >
      <div className="mb-5 flex items-center gap-2">
        <Video aria-hidden="true" className="size-4" />
        <h2 id="video-node-editor-title" className="text-sm font-semibold">
          影片節點
        </h2>
      </div>

      {isReadOnly ? (
        <>
          <h3 className="font-semibold text-foreground">{node.data.title}</h3>
          {node.data.content && (
            <p className="mt-2 text-sm text-foreground/65">
              {node.data.content}
            </p>
          )}
        </>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-sm text-foreground/70">標題</span>
            <input
              type="text"
              value={node.data.title}
              onChange={(event) =>
                updateNode(node.id, { title: event.target.value })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm text-foreground/70">內容</span>
            <textarea
              value={node.data.content}
              onChange={(event) =>
                updateNode(node.id, { content: event.target.value })
              }
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
        </>
      )}

      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault()
          saveSource()
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-foreground/70">
            影片網址
          </span>
          <div className="relative">
            <Link
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40"
            />
            <input
              type="url"
              readOnly={isReadOnly}
              value={draftUrl}
              aria-invalid={formError !== null}
              aria-describedby={formError ? 'video-url-error' : undefined}
              onChange={(event) => {
                setDraftUrl(event.target.value)
                setFormError(null)
              }}
              placeholder="https://example.com/video.mp4"
              className="min-h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-primary focus:ring-2 focus:ring-primary/15 read-only:text-foreground/60"
            />
          </div>
          {formError && (
            <span
              id="video-url-error"
              role="alert"
              className="mt-1 block text-xs text-red-600"
            >
              {formError}
            </span>
          )}
        </label>

        {!isReadOnly && (
          <button
            type="submit"
            disabled={draftUrl.trim() === node.data.source}
            className="mt-3 min-h-11 w-full cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            套用影片網址
          </button>
        )}
      </form>

      {node.data.source && (
        <div className="mt-4 overflow-hidden rounded-lg bg-black">
          <video
            key={node.data.source}
            controls
            preload="metadata"
            src={node.data.source}
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => setFailedSource(node.data.source)}
            className="block aspect-video max-h-[35dvh] w-full object-contain"
          >
            你的瀏覽器不支援影片播放。
          </video>
          {failedSource === node.data.source && (
            <p
              role="alert"
              className="border-t border-red-900/30 bg-red-950 px-3 py-2 text-xs text-red-100"
            >
              影片無法播放，請確認網址可直接開啟影片檔案。
            </p>
          )}
        </div>
      )}

      {!isReadOnly && (
        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => {
              deleteNode(node.id)
              clearMissingActiveContext()
            }}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-red-200 hover:text-red-600"
          >
            只刪除此節點
          </button>
          <button
            type="button"
            onClick={() => {
              deleteBranch(node.id)
              clearMissingActiveContext()
            }}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50"
          >
            刪除此分支
          </button>
        </div>
      )}
    </aside>
  )
}

export function VideoPanel({ isReadOnly = false }: VideoPanelProps) {
  const selectedVideoNode = useCanvasStore((state) =>
    state.nodes.find((node) => node.selected && isVideoNode(node)) as
      | VideoCanvasNode
      | undefined,
  )

  if (!selectedVideoNode) return null

  return (
    <VideoNodeEditor
      key={selectedVideoNode.id}
      node={selectedVideoNode}
      isReadOnly={isReadOnly}
    />
  )
}
