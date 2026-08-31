import { Link, Upload, Video } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, SyntheticEvent } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import type { CanvasNode, VideoCanvasNode } from '../../types/canvas'
import {
  clearLocalVideoFile,
  getLocalVideoFile,
  persistLocalVideoFile,
  pruneLocalVideoFiles,
  restoreLocalVideoFile,
  setLocalVideoFile,
  type LocalVideoFile,
} from '../../utils/localVideoFiles'
import { getBilibiliVideo } from './bilibili'
import { BilibiliPlayer } from './BilibiliPlayer'
import { getDropboxVideoUrl } from './dropbox'
import { VimeoPlayer } from './VimeoPlayer'
import { getVimeoVideoUrl } from './vimeo'
import { YouTubePlayer } from './YouTubePlayer'
import { getYouTubeVideoId } from './youtube'

type VideoPanelProps = {
  isReadOnly?: boolean
}

const supportedLocalVideoExtensions = new Set(['mp4', 'webm', 'mov'])

function validateLocalVideoFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (!supportedLocalVideoExtensions.has(extension)) {
    return '目前先支援 MP4、WebM 與 MOV 影片檔案。'
  }

  if (file.size === 0) return '這個影片檔案沒有內容。'
  return null
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
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

    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    if (
      (hostname === 'bilibili.com' ||
        hostname === 'm.bilibili.com' ||
        hostname === 'player.bilibili.com' ||
        hostname === 'b23.tv') &&
      !getBilibiliVideo(value)
    ) {
      return '請貼上完整的 Bilibili 影片網址，暫不支援 b23.tv 短網址。'
    }

    if (hostname === 'dropbox.com' && !getDropboxVideoUrl(value)) {
      return '請貼上 Dropbox 影片檔案的分享連結，資料夾連結無法播放。'
    }

    if (
      (hostname === 'vimeo.com' || hostname === 'player.vimeo.com') &&
      !getVimeoVideoUrl(value)
    ) {
      return '請貼上包含影片 ID 的 Vimeo 影片網址。'
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
  const videoSeekRequest = useCanvasStore(
    (state) => state.videoSeekRequest,
  )
  const activeContextNodeId = useChatStore((state) => state.activeContextNodeId)
  const setActiveContextNodeId = useChatStore(
    (state) => state.setActiveContextNodeId,
  )
  const [draftUrl, setDraftUrl] = useState(node.data.source)
  const [formError, setFormError] = useState<string | null>(null)
  const [localFileError, setLocalFileError] = useState<string | null>(null)
  const [isSavingLocalVideo, setIsSavingLocalVideo] = useState(false)
  const [localVideo, setLocalVideo] = useState<LocalVideoFile | null>(() =>
    getLocalVideoFile(node.id),
  )
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestedTimeMs =
    videoSeekRequest?.videoNodeId === node.id
      ? videoSeekRequest.timeMs
      : null
  const youtubeVideoId = localVideo ? null : getYouTubeVideoId(node.data.source)
  const vimeoVideoUrl = localVideo ? null : getVimeoVideoUrl(node.data.source)
  const bilibiliVideo = localVideo ? null : getBilibiliVideo(node.data.source)
  const directVideoUrl =
    getDropboxVideoUrl(node.data.source) ?? node.data.source
  const playbackSource = localVideo?.url ?? directVideoUrl

  const handleEmbeddedDuration = useCallback((durationMs: number) => {
    updateVideoNode(node.id, { durationMs })
  }, [node.id, updateVideoNode])

  const handleEmbeddedError = useCallback(() => {
    setFailedSource(node.data.source)
  }, [node.data.source])

  useEffect(() => {
    if (requestedTimeMs === null || !videoRef.current) return
    videoRef.current.currentTime = requestedTimeMs / 1000
  }, [requestedTimeMs, videoSeekRequest?.requestId])

  useEffect(() => {
    if (localVideo) return

    let cancelled = false
    void restoreLocalVideoFile(node.id)
      .then((restoredVideo) => {
        if (!cancelled && restoredVideo) setLocalVideo(restoredVideo)
      })
      .catch(() => {
        if (!cancelled) {
          setLocalFileError('無法從這個瀏覽器恢復本機影片，請重新選擇檔案')
        }
      })

    return () => {
      cancelled = true
    }
  }, [localVideo, node.id])

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
    if (localVideo) {
      clearLocalVideoFile(node.id)
      setLocalVideo(null)
    }
    setFormError(null)
    setLocalFileError(null)
    setFailedSource(null)
  }

  async function selectLocalVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const error = validateLocalVideoFile(file)
    if (error) {
      setLocalFileError(error)
      return
    }

    const nextLocalVideo = setLocalVideoFile(node.id, file)
    setLocalVideo(nextLocalVideo)
    setDraftUrl('')
    setLocalFileError(null)
    setFormError(null)
    setFailedSource(null)
    updateVideoNode(node.id, { source: '', durationMs: undefined })

    setIsSavingLocalVideo(true)
    try {
      await persistLocalVideoFile(node.id, file)
    } catch {
      setLocalFileError(
        '影片可以在目前分頁使用，但無法保存在這個瀏覽器；刷新後需要重新選擇',
      )
    } finally {
      setIsSavingLocalVideo(false)
    }

    if (/^新影片 \d+$/.test(node.data.title)) {
      updateNode(node.id, {
        title: file.name.replace(/\.[^.]+$/, '') || file.name,
      })
    }
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

    if (requestedTimeMs !== null) {
      event.currentTarget.currentTime = requestedTimeMs / 1000
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

      {!isReadOnly && (
        <section className="mt-4 rounded-xl border border-border bg-canvas/45 p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
            onChange={selectLocalVideo}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Upload aria-hidden="true" className="size-4" />
            {localVideo ? '更換本機影片' : '選擇本機影片'}
          </button>
          <p className="mt-2 text-xs leading-5 text-foreground/55">
              支援 MP4、WebM、MOV；檔案只保存在這個瀏覽器，不會寫入雲端專案，只有使用影片片段對話時才會暫時上傳給 Gemini。
          </p>
          {isSavingLocalVideo && (
            <p className="mt-2 text-xs text-foreground/55">
              正在保存在這個瀏覽器，完成後刷新仍可使用…
            </p>
          )}
          {localVideo && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 text-xs">
              <span className="min-w-0 truncate text-foreground/70">
                {localVideo.fileName} · {formatFileSize(localVideo.size)}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearLocalVideoFile(node.id)
                  setLocalVideo(null)
                  updateVideoNode(node.id, { durationMs: undefined })
                  setFailedSource(null)
                }}
                className="min-h-9 shrink-0 cursor-pointer rounded-md px-2 text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              >
                移除
              </button>
            </div>
          )}
          {localFileError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {localFileError}
            </p>
          )}
        </section>
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

      {playbackSource && (
        <div className="mt-4 overflow-hidden rounded-lg bg-black">
          {youtubeVideoId ? (
            <YouTubePlayer
              videoId={youtubeVideoId}
              requestedTimeMs={requestedTimeMs}
              requestId={videoSeekRequest?.requestId}
              onDuration={handleEmbeddedDuration}
              onError={handleEmbeddedError}
            />
          ) : vimeoVideoUrl ? (
            <VimeoPlayer
              source={vimeoVideoUrl}
              requestedTimeMs={requestedTimeMs}
              requestId={videoSeekRequest?.requestId}
              onDuration={handleEmbeddedDuration}
              onError={handleEmbeddedError}
            />
          ) : bilibiliVideo ? (
            <BilibiliPlayer
              video={bilibiliVideo}
              requestedTimeMs={requestedTimeMs}
              requestId={videoSeekRequest?.requestId}
            />
          ) : (
            <video
            ref={videoRef}
            key={playbackSource}
            controls
            preload="metadata"
            src={playbackSource}
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => setFailedSource(playbackSource)}
            className="block aspect-video max-h-[35dvh] w-full object-contain"
          >
            你的瀏覽器不支援影片播放。
          </video>
          )}
          {failedSource === playbackSource && (
            <p
              role="alert"
              className="border-t border-red-900/30 bg-red-950 px-3 py-2 text-xs text-red-100"
            >
              {localVideo
                ? '本機影片無法播放，MOV 是否可播放會依影片編碼與瀏覽器而異。'
                : '影片無法播放，請確認網址可直接開啟影片檔案。'}
            </p>
          )}
        </div>
      )}

      {!isReadOnly && (
        <div className="mt-6 space-y-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => {
              clearLocalVideoFile(node.id)
              deleteNode(node.id)
              clearMissingActiveContext()
            }}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-red-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
          >
            只刪除此節點
          </button>
          <button
            type="button"
            onClick={() => {
              clearLocalVideoFile(node.id)
              deleteBranch(node.id)
              clearMissingActiveContext()
            }}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
          >
            刪除此分支
          </button>
        </div>
      )}
    </aside>
  )
}

export function VideoPanel({ isReadOnly = false }: VideoPanelProps) {
  const nodes = useCanvasStore((state) => state.nodes)
  const selectedVideoNode = useCanvasStore((state) =>
    state.nodes.find((node) => node.selected && isVideoNode(node)) as
      | VideoCanvasNode
      | undefined,
  )

  useEffect(() => {
    pruneLocalVideoFiles(
      new Set(nodes.filter(isVideoNode).map((node) => node.id)),
    )
  }, [nodes])

  if (!selectedVideoNode) return null

  return (
    <VideoNodeEditor
      key={selectedVideoNode.id}
      node={selectedVideoNode}
      isReadOnly={isReadOnly}
    />
  )
}
