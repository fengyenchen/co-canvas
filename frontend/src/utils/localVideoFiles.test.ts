import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllLocalVideoFiles,
  clearLocalVideoFile,
  getLocalVideoFile,
  persistLocalVideoFile,
  pruneLocalVideoFiles,
  restoreLocalVideoFile,
  setLocalVideoFile,
} from './localVideoFiles'

describe('localVideoFiles', () => {
  const createObjectURL = vi.fn(() => 'blob:local-video')
  const revokeObjectURL = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })
  })

  afterEach(() => {
    clearAllLocalVideoFiles()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('保存並釋放影片節點的暫時物件網址', () => {
    const file = new File(['video'], 'idea.mp4', { type: 'video/mp4' })

    expect(setLocalVideoFile('video-1', file)).toMatchObject({
      fileName: 'idea.mp4',
      mimeType: 'video/mp4',
      url: 'blob:local-video',
    })
    expect(getLocalVideoFile('video-1')?.size).toBe(file.size)

    clearLocalVideoFile('video-1')
    expect(getLocalVideoFile('video-1')).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-video')
  })

  it('移除畫布中已不存在節點的本機影片', () => {
    setLocalVideoFile(
      'keep',
      new File(['a'], 'keep.webm', { type: 'video/webm' }),
    )
    setLocalVideoFile(
      'remove',
      new File(['b'], 'remove.mov', { type: 'video/quicktime' }),
    )

    pruneLocalVideoFiles(new Set(['keep']))

    expect(getLocalVideoFile('keep')).not.toBeNull()
    expect(getLocalVideoFile('remove')).toBeNull()
  })

  it('刷新釋放記憶體後可從瀏覽器私人檔案空間恢復', async () => {
    const storedFiles = new Map<string, Blob>()
    const directory = {
      getFileHandle: vi.fn(async (name: string, options?: { create?: boolean }) => {
        if (!storedFiles.has(name) && !options?.create) {
          throw new DOMException('Not found', 'NotFoundError')
        }
        return {
          createWritable: async () => ({
            write: async (value: Blob | string) => {
              storedFiles.set(
                name,
                typeof value === 'string' ? new Blob([value]) : value,
              )
            },
            close: async () => {},
          }),
          getFile: async () => {
            const value = storedFiles.get(name)
            if (!value) throw new DOMException('Not found', 'NotFoundError')
            return new File([value], name, { type: value.type })
          },
        }
      }),
      removeEntry: vi.fn(async (name: string) => {
        storedFiles.delete(name)
      }),
    }
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: async () => ({
          getDirectoryHandle: async () => directory,
        }),
        persist: async () => true,
      },
    })
    const file = new File(['persistent video'], 'idea.mp4', {
      type: 'video/mp4',
      lastModified: 123,
    })

    setLocalVideoFile('video-persistent', file)
    await persistLocalVideoFile('video-persistent', file)
    clearAllLocalVideoFiles()

    expect(getLocalVideoFile('video-persistent')).toBeNull()
    await expect(
      restoreLocalVideoFile('video-persistent'),
    ).resolves.toMatchObject({
      fileName: 'idea.mp4',
      mimeType: 'video/mp4',
      size: file.size,
    })
  })
})
