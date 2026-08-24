export function getDropboxVideoUrl(source: string): string | null {
  try {
    const url = new URL(source)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    const isSharedFile =
      url.pathname.startsWith('/s/') || url.pathname.startsWith('/scl/fi/')

    if (hostname !== 'dropbox.com' || !isSharedFile) return null

    url.searchParams.delete('dl')
    url.searchParams.set('raw', '1')
    return url.toString()
  } catch {
    return null
  }
}
