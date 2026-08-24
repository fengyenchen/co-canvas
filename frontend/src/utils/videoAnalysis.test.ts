import { describe, expect, it } from 'vitest'
import type { VideoCanvasNode } from '../types/canvas'
import { createVideoAnalysisRequest } from './videoAnalysis'

const videoNode: VideoCanvasNode = {
  id: 'video-1',
  type: 'video',
  position: { x: 0, y: 0 },
  data: {
    title: '研究影片',
    content: '',
    origin: 'user',
    sourceType: 'url',
    source: 'https://www.youtube.com/watch?v=9hE5-98ZeCg',
  },
}

describe('createVideoAnalysisRequest', () => {
  it('建立公開 YouTube 影片的分析請求', () => {
    expect(createVideoAnalysisRequest(videoNode, '整理重點', 5)).toEqual({
      videoNodeId: 'video-1',
      provider: 'youtube',
      source: videoNode.data.source,
      title: '研究影片',
      prompt: '整理重點',
      maxSegments: 5,
    })
  })

  it('拒絕其他來源與空白指令', () => {
    expect(createVideoAnalysisRequest(
      {
        ...videoNode,
        data: { ...videoNode.data, source: 'https://example.com/video.mp4' },
      },
      '整理重點',
      5,
    )).toBeNull()
    expect(createVideoAnalysisRequest(videoNode, '   ', 5)).toBeNull()
  })
})
