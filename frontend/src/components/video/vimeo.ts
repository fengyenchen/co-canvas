export type VimeoVideoUrl =
  | `https://vimeo.com/${string}`
  | `https://player.vimeo.com/video/${string}`

export function getVimeoVideoUrl(source: string): VimeoVideoUrl | null {
  if (!source) return null

  try {
    const url = new URL(source)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')

    if (hostname !== 'vimeo.com' && hostname !== 'player.vimeo.com') {
      return null
    }

    const hasVideoId = url.pathname
      .split('/')
      .filter(Boolean)
      .some((part) => /^\d+$/.test(part))

    if (!hasVideoId) return null

    if (hostname === 'player.vimeo.com') {
      return `https://player.vimeo.com${url.pathname}${url.search}` as VimeoVideoUrl
    }

    return `https://vimeo.com${url.pathname}${url.search}` as VimeoVideoUrl
  } catch {
    return null
  }
}
