import type { BilibiliVideo } from './bilibili'
import { createBilibiliEmbedUrl } from './bilibili'

type BilibiliPlayerProps = {
  video: BilibiliVideo
  requestedTimeMs: number | null
  requestId?: string
}

export function BilibiliPlayer({
  video,
  requestedTimeMs,
  requestId,
}: BilibiliPlayerProps) {
  const source = createBilibiliEmbedUrl(video, requestedTimeMs)

  return (
    <iframe
      key={`${video.bvid ?? video.aid}-${video.page}-${requestId ?? 'initial'}`}
      src={source}
      title="Bilibili 影片播放器"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      className="aspect-video w-full border-0"
    />
  )
}
