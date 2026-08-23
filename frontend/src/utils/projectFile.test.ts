import { describe, expect, it } from 'vitest'
import type {
  CanvasEdge,
  ConceptCanvasNode,
  VideoCanvasNode,
} from '../types/canvas'
import type { ChatMessage } from '../types/chat'
import {
  createProjectFile,
  parseProjectFile,
  projectDocumentSchema,
} from './projectFile'

const videoNode: VideoCanvasNode = {
  id: 'video-1',
  type: 'video',
  position: { x: 100, y: 0 },
  data: {
    title: '研究影片',
    content: '',
    origin: 'user',
    sourceType: 'url',
    source: 'https://example.com/video.mp4',
    durationMs: 60_000,
  },
}

const nodes: ConceptCanvasNode[] = [
  {
    id: 'node-1',
    type: 'concept',
    position: { x: 100, y: 200 },
    data: {
      title: '研究目標',
      content: '釐清研究問題',
      origin: 'user',
    },
  },
  {
    id: 'node-2',
    type: 'concept',
    position: { x: 100, y: 400 },
    data: {
      title: '下一步',
      content: '規劃訪談',
      origin: 'ai',
    },
  },
]

const edges: CanvasEdge[] = [
  {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    label: '延伸',
    data: { label: '延伸', origin: 'ai' },
  },
]

const messages: ChatMessage[] = [
  {
    id: 'message-1',
    role: 'user',
    content: '如何規劃？',
    contextNodeId: 'node-1',
    createdAt: '2026-08-14T00:00:00.000Z',
  },
  {
    id: 'orphan-message',
    role: 'ai',
    content: '舊節點的回覆',
    contextNodeId: 'deleted-node',
    createdAt: '2026-08-14T00:00:01.000Z',
  },
]

describe('projectFile', () => {
  it('允許尚未設定網址的空白影片節點', () => {
    const blankVideo: VideoCanvasNode = {
      ...videoNode,
      data: { ...videoNode.data, source: '', durationMs: undefined },
    }

    expect(() =>
      parseProjectFile(createProjectFile([blankVideo], [], [])),
    ).not.toThrow()
  })

  it('匯出時排除孤兒對話', () => {
    const project = createProjectFile(nodes, edges, messages)

    expect(project.version).toBe(3)
    expect(project.messages.map((message) => message.id)).toEqual(['message-1'])
  })

  it('保留多個影片節點與節點時間綁定', () => {
    const secondVideo: VideoCanvasNode = {
      ...videoNode,
      id: 'video-2',
      data: {
        ...videoNode.data,
        source: 'https://example.com/second.mp4',
      },
    }
    const timedNode: ConceptCanvasNode = {
      ...nodes[0]!,
      data: {
        ...nodes[0]!.data,
        mediaNodeId: 'video-2',
        startTimeMs: 1_000,
        endTimeMs: 5_000,
      },
    }

    const imported = parseProjectFile(
      createProjectFile([videoNode, secondVideo, timedNode], [], []),
    )

    expect(imported.nodes.filter((node) => node.type === 'video')).toHaveLength(2)
    expect(imported.nodes[2]?.data).toMatchObject({
      mediaNodeId: 'video-2',
      startTimeMs: 1_000,
      endTimeMs: 5_000,
    })
  })

  it('自動將 version 2 單一影片升級為影片節點', () => {
    const legacyProject = {
      version: 2,
      media: {
        type: 'video',
        sourceType: 'url',
        source: 'https://example.com/video.mp4',
        title: '舊影片',
        durationMs: 60_000,
      },
      nodes: [
        {
          ...nodes[0]!,
          data: {
            ...nodes[0]!.data,
            startTimeMs: 1_000,
            endTimeMs: 5_000,
          },
        },
      ],
      edges: [],
      messages: [],
      exportedAt: '2026-08-14T00:00:00.000Z',
    }

    const imported = parseProjectFile(legacyProject)
    const migratedVideo = imported.nodes.find((node) => node.type === 'video')

    expect(imported.version).toBe(3)
    expect(migratedVideo?.data.title).toBe('舊影片')
    expect(imported.nodes[0]?.data).toMatchObject({
      mediaNodeId: migratedVideo?.id,
    })
  })

  it('自動將 version 1 舊專案升級為 version 3', () => {
    const imported = parseProjectFile({
      ...createProjectFile(nodes, edges, messages),
      version: 1,
    })

    expect(imported.version).toBe(3)
  })

  it('拒絕不存在的影片節點與超出影片長度的區間', () => {
    const missingVideoNode: ConceptCanvasNode = {
      ...nodes[0]!,
      data: {
        ...nodes[0]!.data,
        mediaNodeId: 'missing',
        startTimeMs: 1_000,
        endTimeMs: 2_000,
      },
    }
    const nodePastDuration: ConceptCanvasNode = {
      ...nodes[0]!,
      data: {
        ...nodes[0]!.data,
        mediaNodeId: 'video-1',
        startTimeMs: 59_000,
        endTimeMs: 61_000,
      },
    }

    expect(() =>
      parseProjectFile(createProjectFile([missingVideoNode], [], [])),
    ).toThrow('節點引用了不存在的影片節點')
    expect(() =>
      parseProjectFile(createProjectFile([videoNode, nodePastDuration], [], [])),
    ).toThrow('節點時間不得超出影片長度')
  })

  it('匯出的資料可以再次匯入', () => {
    const exported = createProjectFile([videoNode, ...nodes], edges, messages)
    const imported = parseProjectFile(JSON.parse(JSON.stringify(exported)))

    expect(imported.nodes).toEqual(exported.nodes)
    expect(imported.edges).toEqual(exported.edges)
    expect(imported.messages).toEqual(exported.messages)
  })

  it('接受後端回傳為 null 的可選欄位', () => {
    const project = projectDocumentSchema.parse({
      version: 1,
      nodes,
      edges: [
        {
          id: 'edge-without-label',
          source: 'node-1',
          target: 'node-2',
          label: null,
          data: null,
        },
      ],
      messages: [
        {
          id: 'message-with-null-fields',
          role: 'ai',
          content: '測試回覆',
          contextNodeId: null,
          createdAt: '2026-08-14T00:00:00.000Z',
          canGenerateNodes: null,
          latencyMs: null,
          isError: null,
          retryAction: null,
          retryContent: null,
        },
      ],
    })

    expect(project.edges[0]?.label).toBeUndefined()
    expect(project.edges[0]?.data).toBeUndefined()
    expect(project.messages[0]?.latencyMs).toBeUndefined()
  })
})
