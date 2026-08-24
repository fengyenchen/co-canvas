import Player from '@vimeo/player'
import { useEffect, useRef } from 'react'
import type { VimeoVideoUrl } from './vimeo'

type VimeoPlayerProps = {
  source: VimeoVideoUrl
  requestedTimeMs: number | null
  requestId?: string
  onDuration: (durationMs: number) => void
  onError: () => void
}

export function VimeoPlayer({
  source,
  requestedTimeMs,
  requestId,
  onDuration,
  onError,
}: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)
  const requestedTimeRef = useRef(requestedTimeMs)

  useEffect(() => {
    requestedTimeRef.current = requestedTimeMs
  }, [requestedTimeMs])

  useEffect(() => {
    if (!containerRef.current) return

    const player = new Player(containerRef.current, {
      url: source,
      responsive: true,
    })
    playerRef.current = player

    player.on('error', onError)

    void player.ready()
      .then(async () => {
        const duration = await player.getDuration()
        if (duration > 0) onDuration(Math.round(duration * 1000))
        if (requestedTimeRef.current !== null) {
          await player.setCurrentTime(requestedTimeRef.current / 1000)
        }
      })
      .catch(onError)

    return () => {
      player.off('error', onError)
      void player.destroy()
      playerRef.current = null
    }
  }, [onDuration, onError, source])

  useEffect(() => {
    if (requestedTimeMs !== null) {
      void playerRef.current
        ?.setCurrentTime(requestedTimeMs / 1000)
        .catch(onError)
    }
  }, [onError, requestedTimeMs, requestId])

  return <div ref={containerRef} className="aspect-video w-full" />
}
