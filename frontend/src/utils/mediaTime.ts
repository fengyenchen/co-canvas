export type MediaTimeFormat = 'seconds' | 'minutes' | 'hours'

export function getMediaTimeFormat(durationMs?: number): MediaTimeFormat {
  if (durationMs !== undefined && durationMs >= 60 * 60 * 1000) {
    return 'hours'
  }
  if (durationMs !== undefined && durationMs >= 60 * 1000) {
    return 'minutes'
  }
  return 'seconds'
}

function formatSeconds(seconds: number, pad = false): string {
  const rounded = Math.round(seconds * 10) / 10
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return pad ? value.padStart(2, '0') : value
}

export function formatMediaTimeInput(
  timeMs?: number,
  durationMs?: number,
): string {
  if (timeMs === undefined) return ''

  const totalSeconds = Math.max(0, timeMs / 1000)
  const format = getMediaTimeFormat(durationMs)
  if (format === 'seconds') return formatSeconds(totalSeconds)

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const secondsText = formatSeconds(seconds, true)

  if (format === 'hours') {
    return `${hours}:${String(minutes).padStart(2, '0')}:${secondsText}`
  }
  return `${Math.floor(totalSeconds / 60)}:${secondsText}`
}

export function parseMediaTimeInput(value: string): number | null {
  const parts = value.trim().split(':')
  if (parts.length < 1 || parts.length > 3 || parts.some((part) => !part)) {
    return null
  }

  const values = parts.map(Number)
  if (values.some((part) => !Number.isFinite(part) || part < 0)) {
    return null
  }
  if (parts.length > 1 && values.slice(1).some((part) => part >= 60)) {
    return null
  }
  if (parts.length === 3 && !Number.isInteger(values[0])) return null
  if (parts.length > 1 && !Number.isInteger(values.at(-2)!)) return null

  const seconds = values.at(-1)!
  const minutes = values.length >= 2 ? values.at(-2)! : 0
  const hours = values.length === 3 ? values[0] : 0
  return hours * 3600 + minutes * 60 + seconds
}

export function getMediaTimeInputLabel(
  label: string,
  durationMs?: number,
): string {
  const format = getMediaTimeFormat(durationMs)
  if (format === 'hours') return `${label}（時:分:秒）`
  if (format === 'minutes') return `${label}（分:秒）`
  return `${label}（秒）`
}

export function getMediaTimePlaceholder(durationMs?: number): string {
  const format = getMediaTimeFormat(durationMs)
  if (format === 'hours') return '0:00:00'
  if (format === 'minutes') return '0:00'
  return '0'
}

export function formatMediaTime(timeMs: number, referenceMs = timeMs): string {
  const value = formatMediaTimeInput(timeMs, referenceMs)
  return getMediaTimeFormat(referenceMs) === 'seconds' ? `${value} 秒` : value
}
