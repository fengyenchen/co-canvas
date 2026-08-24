import { describe, expect, it } from 'vitest'
import { getDropboxVideoUrl } from './dropbox'

describe('getDropboxVideoUrl', () => {
  it('將新版 Dropbox 分享網址轉成直接呈現網址', () => {
    expect(
      getDropboxVideoUrl(
        'https://www.dropbox.com/scl/fi/token/video.mp4?rlkey=key&dl=0',
      ),
    ).toBe(
      'https://www.dropbox.com/scl/fi/token/video.mp4?rlkey=key&raw=1',
    )
  })

  it('支援舊版 Dropbox 分享網址', () => {
    expect(
      getDropboxVideoUrl('https://www.dropbox.com/s/token/video.mp4?dl=1'),
    ).toBe('https://www.dropbox.com/s/token/video.mp4?raw=1')
  })

  it('忽略資料夾與非 Dropbox 網址', () => {
    expect(
      getDropboxVideoUrl('https://www.dropbox.com/scl/fo/token/folder'),
    ).toBeNull()
    expect(getDropboxVideoUrl('https://example.com/video.mp4')).toBeNull()
  })
})
