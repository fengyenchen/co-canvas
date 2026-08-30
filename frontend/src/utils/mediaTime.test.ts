import { describe, expect, it } from 'vitest'
import {
  formatMediaDuration,
  formatMediaTime,
  formatMediaTimeInput,
  getMediaTimeInputLabel,
  parseMediaTimeInput,
} from './mediaTime'

describe('mediaTime', () => {
  it('formats inputs according to video duration', () => {
    expect(formatMediaTimeInput(12_500, 30_000)).toBe('12.5')
    expect(formatMediaTimeInput(90_000, 10 * 60_000)).toBe('1:30')
    expect(formatMediaTimeInput(3_661_000, 2 * 3_600_000)).toBe('1:01:01')
  })

  it('formats duration without decimals or a unit suffix', () => {
    expect(formatMediaDuration(4_100)).toBe('4')
    expect(formatMediaDuration(240_100)).toBe('4:00')
  })

  it('formats displayed time ranges to whole seconds', () => {
    expect(formatMediaTime(240_100, 240_100)).toBe('4:00')
  })

  it('parses seconds, minute and hour inputs', () => {
    expect(parseMediaTimeInput('12.5')).toBe(12.5)
    expect(parseMediaTimeInput('1:30')).toBe(90)
    expect(parseMediaTimeInput('1:01:01')).toBe(3661)
    expect(parseMediaTimeInput('1:75')).toBeNull()
  })

  it('describes the expected format', () => {
    expect(getMediaTimeInputLabel('開始', 30_000)).toBe('開始（秒）')
    expect(getMediaTimeInputLabel('開始', 90_000)).toBe('開始（分:秒）')
    expect(getMediaTimeInputLabel('開始', 3_600_000)).toBe('開始（時:分:秒）')
  })
})
