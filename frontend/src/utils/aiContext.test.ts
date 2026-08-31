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
        source: 'https://www.youtube.com/watch?v=example',
        durationMs: 60_000,
      },
    })
  })

  it('建立包含成員與相關連線的群組上下文', () => {
    const groupedNodes: CanvasNode[] = [
      {
        id: 'group-1',
        type: 'group',
        position: { x: 0, y: 0 },
        data: { title: '研究發現', width: 600, height: 400 },
      },
      {
        ...nodes[1],
        parentId: 'group-1',
        position: { x: 32, y: 64 },
      },
      nodes[0],
    ]

    expect(createAiContextNode(groupedNodes[0], groupedNodes, edges)).toEqual({
      id: 'group-1',
      title: '研究發現',
      content: '',
      nodeType: 'group',
      groupMembers: [
        expect.objectContaining({
          id: 'concept-1',
          title: '關鍵發現',
          nodeType: 'concept',
        }),
      ],
      groupRelations: [
        { source: 'video-1', target: 'concept-1' },
      ],
    })
  })

  it('讓相連文件與頁面範圍成為文字節點附件上下文', () => {
    const documentNode: CanvasNode = {
      id: 'document-1',
      type: 'document',
      position: { x: 0, y: 0 },
      data: {
        title: '研究報告', content: '', origin: 'user', fileName: 'report.pdf',
        mimeType: 'application/pdf', size: 2048, pageCount: 12, pageUnit: 'page',
      },
    }
    const conceptNode: CanvasNode = {
      id: 'concept-document', type: 'concept', position: { x: 0, y: 200 },
      data: {
        title: '前十頁重點', content: '', origin: 'user',
        documentStartPage: 1, documentEndPage: 10,
      },
    }
    const documentEdge: CanvasEdge = {
      id: 'edge-document', source: documentNode.id, target: conceptNode.id,
      data: { origin: 'user' },
    }

    expect(createAiContextNode(conceptNode, [documentNode, conceptNode], [documentEdge])).toEqual(
      expect.objectContaining({
        documentStartPage: 1,
        documentEndPage: 10,
        linkedFile: expect.objectContaining({
          id: 'document-1', fileName: 'report.pdf', pageCount: 12, pageUnit: 'page',
        }),
      }),
    )
  })

  it('讓相連音訊與時間區間成為文字節點附件上下文', () => {
    const audioNode: CanvasNode = {
      id: 'audio-1',
      type: 'audio',
      position: { x: 0, y: 0 },
      data: {
        title: '訪談錄音', content: '', origin: 'user', fileName: 'interview.mp3',
        mimeType: 'audio/mpeg', size: 4096, durationMs: 90_000,
      },
    }
    const conceptNode: CanvasNode = {
      id: 'concept-audio', type: 'concept', position: { x: 0, y: 200 },
      data: {
        title: '訪談重點', content: '', origin: 'user',
        startTimeMs: 10_000, endTimeMs: 30_000,
      },
    }
    const audioEdge: CanvasEdge = {
      id: 'edge-audio', source: audioNode.id, target: conceptNode.id,
      data: { origin: 'user' },
    }

    expect(createAiContextNode(conceptNode, [audioNode, conceptNode], [audioEdge])).toEqual(
      expect.objectContaining({
        startTimeMs: 10_000,
        endTimeMs: 30_000,
        linkedFile: expect.objectContaining({
          id: 'audio-1', nodeType: 'audio', fileName: 'interview.mp3', durationMs: 90_000,
        }),
      }),
    )
  })
})
