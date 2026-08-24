import { describe, expect, it } from 'vitest'
import { createBilibiliEmbedUrl, getBilibiliVideo } from './bilibili'

describe('getBilibiliVideo', () => {
  it('解析 BV 與多 P 影片網址', () => {
    expect(
      getBilibiliVideo('https://www.bilibili.com/video/BV1B7411m7LV?p=2'),
    ).toEqual({ bvid: 'BV1B7411m7LV', page: 2 })
  })

  it('解析 av 影片網址', () => {
    expect(getBilibiliVideo('https://www.bilibili.com/video/av170001')).toEqual({
      aid: '170001',
      page: 1,
    })
  })

  it('拒絕短網址與非影片網址', () => {
    expect(getBilibiliVideo('https://b23.tv/example')).toBeNull()
    expect(getBilibiliVideo('https://www.bilibili.com/')).toBeNull()
  })
})

describe('createBilibiliEmbedUrl', () => {
  it('建立指定起始秒數的官方播放器網址', () => {
    const result = new URL(
      createBilibiliEmbedUrl({ bvid: 'BV1B7411m7LV', page: 1 }, 12_900),
    )

    expect(result.origin + result.pathname).toBe(
      'https://player.bilibili.com/player.html',
    )
    expect(result.searchParams.get('bvid')).toBe('BV1B7411m7LV')
    expect(result.searchParams.get('t')).toBe('12')
    expect(result.searchParams.get('autoplay')).toBe('1')
  })
})
