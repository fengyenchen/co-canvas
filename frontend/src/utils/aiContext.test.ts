import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import { createAiContextNode } from './aiContext'

const nodes: CanvasNode[] = [
  {
    id: 'video-1',
    type: 'video',
    position: { x: 0, y: 0 },
    data: {
      title: '研究影片',
      content: '訪談紀錄',
      origin: 'user',
      sourceType: 'url',
      source: 'https://www.youtube.com/watch?v=example',
      durationMs: 60_000,
    },
  },
  {
    id: 'concept-1',
    type: 'concept',
    position: { x: 0, y: 200 },
    data: {
      title: '關鍵發現',
      content: '使用者需要保留操作控制權',
      origin: 'user',
      startTimeMs: 10_000,
      endTimeMs: 20_000,
    },
  },
]

const edges: CanvasEdge[] = [
  {
    id: 'edge-1',
    source: 'video-1',
    target: 'concept-1',
    data: { origin: 'user' },
  },
]

describe('createAiContextNode', () => {
  it('建立不包含原始網址的影片節點上下文', () => {
    expect(createAiContextNode(nodes[0], nodes, edges)).toEqual({
      id: 'video-1',
      title: '研究影片',
      content: '訪談紀錄',
      nodeType: 'video',
      videoProvider: 'YouTube',
      videoDurationMs: 60_000,
    })
  })

  it('建立包含時間與連接影片的文字節點上下文', () => {
    expect(createAiContextNode(nodes[1], nodes, edges)).toEqual({
      id: 'concept-1',
      title: '關鍵發現',
      content: '使用者需要保留操作控制權',
      nodeType: 'concept',
      startTimeMs: 10_000,
      endTimeMs: 20_000,
      linkedVideo: {
        id: 'video-1',
        title: '研究影片',
        provider: 'YouTube',
        durationMs: 60_000,
      },
    })
  })
})
