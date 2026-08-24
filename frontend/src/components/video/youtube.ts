export function getYouTubeVideoId(source: string): string | null {
  if (!source) return null

  try {
    const url = new URL(source)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    let candidate: string | null = null

    if (hostname === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? null
    } else if (
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtube-nocookie.com' ||
      hostname.endsWith('.youtube-nocookie.com')
    ) {
      candidate = url.searchParams.get('v')
      if (!candidate) {
        const parts = url.pathname.split('/').filter(Boolean)
        if (['shorts', 'embed', 'live'].includes(parts[0] ?? '')) {
          candidate = parts[1] ?? null
        }
      }
    }

    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)
      ? candidate
      : null
  } catch {
    return null
  }
}
