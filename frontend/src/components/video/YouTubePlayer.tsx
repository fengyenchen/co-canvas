import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'

type YouTubePlayerInstance = {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}

type YouTubePlayerEvent = {
  target: YouTubePlayerInstance
  data: number
}

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars: { playsinline: number; origin: string }
      events: {
        onReady: (event: YouTubePlayerEvent) => void
        onStateChange: (event: YouTubePlayerEvent) => void
        onError: () => void
      }
    },
  ) => YouTubePlayerInstance
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      if (window.YT) resolve(window.YT)
    }

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })

  return apiPromise
}

type YouTubePlayerProps = {
  nodeId: string
  videoId: string
  requestedTimeMs: number | null
  requestId?: string
  onDuration: (durationMs: number) => void
  onError: () => void
}

export function YouTubePlayer({
  nodeId,
  videoId,
  requestedTimeMs,
  requestId,
  onDuration,
  onError,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const requestedTimeRef = useRef(requestedTimeMs)
  const updateVideoPlayback = useCanvasStore(
    (state) => state.updateVideoPlayback,
  )

  useEffect(() => {
    requestedTimeRef.current = requestedTimeMs
  }, [requestedTimeMs])

  useEffect(() => {
    let disposed = false

    function stopPolling() {
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }

    void loadYouTubeApi().then((YT) => {
      if (disposed || !containerRef.current) return

      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: { playsinline: 1, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            const durationMs = Math.round(target.getDuration() * 1000)
            if (durationMs > 0) onDuration(durationMs)
            if (requestedTimeRef.current !== null) {
              target.seekTo(requestedTimeRef.current / 1000, true)
            }
          },
          onStateChange: ({ target, data }) => {
            const isPlaying = data === 1
            updateVideoPlayback(
              nodeId,
              Math.round(target.getCurrentTime() * 1000),
              isPlaying,
            )
            stopPolling()
            if (isPlaying) {
              pollTimerRef.current = window.setInterval(() => {
                updateVideoPlayback(
                  nodeId,
                  Math.round(target.getCurrentTime() * 1000),
                  true,
                )
              }, 250)
            }
          },
          onError,
        },
      })
    })

    return () => {
      disposed = true
      stopPolling()
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [nodeId, onDuration, onError, updateVideoPlayback, videoId])

  useEffect(() => {
    if (requestedTimeMs !== null) {
      playerRef.current?.seekTo(requestedTimeMs / 1000, true)
    }
  }, [requestedTimeMs, requestId])

  return <div ref={containerRef} className="aspect-video w-full" />
}
