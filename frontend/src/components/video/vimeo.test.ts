import { describe, expect, it } from 'vitest'
import { getVimeoVideoUrl } from './vimeo'

describe('getVimeoVideoUrl', () => {
  it.each([
    'https://vimeo.com/76979871',
    'https://player.vimeo.com/video/76979871',
    'https://vimeo.com/76979871/8272103f6e',
    'https://player.vimeo.com/video/76979871?h=8272103f6e',
  ])('辨識 Vimeo 網址：%s', (source) => {
    expect(getVimeoVideoUrl(source)).toBe(new URL(source).toString())
  })

  it('忽略非 Vimeo 與缺少影片 ID 的網址', () => {
    expect(getVimeoVideoUrl('https://example.com/video.mp4')).toBeNull()
    expect(getVimeoVideoUrl('https://vimeo.com/channels/staffpicks')).toBeNull()
  })
})
