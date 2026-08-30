import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadLocalVideoToGemini } from './videoUploads'

describe('uploadLocalVideoToGemini', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('starts a resumable upload and sends the file directly to Gemini', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uploadUrl: 'https://generativelanguage.googleapis.com/upload/session-1',
        chunkSize: 8 * 1024 * 1024,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        fileName: 'files/video_123',
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['video'], 'sample.MOV', { type: 'video/quicktime' })

    await expect(uploadLocalVideoToGemini({ file })).resolves.toBe(
      'files/video_123',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]?.body).toContain('"mimeType":"video/mov"')
    expect(fetchMock.mock.calls[1][0].toString()).toContain('/api/video-uploads/chunk')
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(Blob)
  })
})
