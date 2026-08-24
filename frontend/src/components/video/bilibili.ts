export type BilibiliVideo = {
  bvid?: string
  aid?: string
  page: number
}

export function getBilibiliVideo(source: string): BilibiliVideo | null {
  try {
    const url = new URL(source)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')

    if (
      hostname !== 'bilibili.com' &&
      hostname !== 'm.bilibili.com' &&
      hostname !== 'player.bilibili.com'
    ) {
      return null
    }

    const pageValue = Number(url.searchParams.get('p') ?? '1')
    const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1
    const bvidFromQuery = url.searchParams.get('bvid')
    const aidFromQuery = url.searchParams.get('aid')
    const pathId = url.pathname.match(/\/video\/(BV[0-9A-Za-z]+|av\d+)/i)?.[1]

    const bvid = bvidFromQuery ??
      (pathId?.toLowerCase().startsWith('bv') ? pathId : undefined)
    const aid = aidFromQuery ??
      (pathId?.toLowerCase().startsWith('av') ? pathId.slice(2) : undefined)

    if (bvid) return { bvid, page }
    if (aid && /^\d+$/.test(aid)) return { aid, page }
    return null
  } catch {
    return null
  }
}

export function createBilibiliEmbedUrl(
  video: BilibiliVideo,
  startTimeMs?: number | null,
): string {
  const url = new URL('https://player.bilibili.com/player.html')

  if (video.bvid) url.searchParams.set('bvid', video.bvid)
  if (video.aid) url.searchParams.set('aid', video.aid)
  url.searchParams.set('p', String(video.page))
  url.searchParams.set('danmaku', '0')
  url.searchParams.set('autoplay', startTimeMs === null || startTimeMs === undefined ? '0' : '1')

  if (startTimeMs !== null && startTimeMs !== undefined) {
    url.searchParams.set('t', String(Math.max(0, Math.floor(startTimeMs / 1000))))
  }

  return url.toString()
}
