import { describe, expect, it } from 'vitest'
import { getYouTubeVideoId } from './youtube'

describe('getYouTubeVideoId', () => {
  it.each([
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtu.be/M7lc1UVf-VE?t=10',
    'https://www.youtube.com/shorts/M7lc1UVf-VE',
    'https://www.youtube.com/embed/M7lc1UVf-VE',
  ])('辨識 YouTube 網址：%s', (source) => {
    expect(getYouTubeVideoId(source)).toBe('M7lc1UVf-VE')
  })

  it('忽略一般影片與無效網址', () => {
    expect(getYouTubeVideoId('https://example.com/video.mp4')).toBeNull()
    expect(getYouTubeVideoId('not-a-url')).toBeNull()
  })
})
