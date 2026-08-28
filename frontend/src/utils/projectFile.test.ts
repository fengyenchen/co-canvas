import { describe, expect, it } from 'vitest'
import type {
  CanvasEdge,
  ConceptCanvasNode,
  GroupCanvasNode,
  VideoCanvasNode,
} from '../types/canvas'
import type { ChatMessage } from '../types/chat'
import type { SuggestionDecisionEvent } from '../types/suggestion'
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
    authorId: 'user-1',
    authorEmail: 'user@example.com',
    authorName: '測試使用者',
  },
  {
    id: 'orphan-message',
    role: 'ai',
    content: '舊節點的回覆',
    contextNodeId: 'deleted-node',
    createdAt: '2026-08-14T00:00:01.000Z',
  },
]

const suggestionEvents: SuggestionDecisionEvent[] = [
  {
    id: 'suggestion-event-1',
    action: 'accepted',
    contextNodeId: 'deleted-node',
    aiMode: 'mock',
    edited: true,
    decisionTimeMs: 1_250,
    nodeCount: 2,
    createdAt: '2026-08-24T00:00:00.000Z',
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

  it('保留文字節點顏色並相容舊專案', () => {
    const coloredNode: ConceptCanvasNode = {
      ...nodes[0],
      data: { ...nodes[0].data, color: 'yellow' },
    }
    const imported = parseProjectFile(
      JSON.parse(JSON.stringify(createProjectFile([coloredNode], [], []))),
    )
    const legacyImported = parseProjectFile(
      JSON.parse(JSON.stringify(createProjectFile([nodes[1]], [], []))),
    )

    expect(imported.nodes[0]?.data).toMatchObject({ color: 'yellow' })
    expect(legacyImported.nodes[0]?.data).toMatchObject({ color: 'default' })
  })

  it('保留群組名稱、尺寸與節點成員關係', () => {
    const group: GroupCanvasNode = {
      id: 'group-1',
      type: 'group',
      position: { x: 50, y: 80 },
      data: {
        title: '訪談發現',
        width: 640,
        height: 360,
        color: 'purple',
        collapsed: true,
        locked: true,
      },
    }
    const groupedNode: ConceptCanvasNode = {
      ...nodes[0],
      parentId: group.id,
      position: { x: 32, y: 64 },
    }

    const exported = createProjectFile([group, groupedNode], [], [])
    const imported = parseProjectFile(JSON.parse(JSON.stringify(exported)))

    expect(imported.nodes[0]).toMatchObject({
      id: 'group-1',
      type: 'group',
      data: {
        title: '訪談發現',
        width: 640,
        height: 360,
        color: 'purple',
        collapsed: true,
        locked: true,
      },
    })
    expect(imported.nodes[1]).toMatchObject({
      id: 'node-1',
      parentId: 'group-1',
      position: { x: 32, y: 64 },
    })
  })

  it('拒絕引用不存在群組的節點', () => {
    const orphanedMember: ConceptCanvasNode = {
      ...nodes[0],
      parentId: 'missing-group',
    }

    expect(() =>
      parseProjectFile(createProjectFile([orphanedMember], [], [])),
    ).toThrow('群組成員引用了不存在的群組')
  })

  it('匯出時排除孤兒對話', () => {
    const project = createProjectFile(nodes, edges, messages)

    expect(project.version).toBe(4)
    expect(project.messages.map((message) => message.id)).toEqual(['message-1'])
    expect(project.messages[0]).toMatchObject({
      authorId: 'user-1',
      authorEmail: 'user@example.com',
      authorName: '測試使用者',
    })
  })

  it('保留 AI 建議決策紀錄與已刪除節點的歷史參照', () => {
    const project = createProjectFile(
      nodes,
      edges,
      messages,
      suggestionEvents,
    )
    const imported = parseProjectFile(JSON.parse(JSON.stringify(project)))

    expect(imported.suggestionEvents).toEqual(suggestionEvents)
  })

  it('舊專案未包含建議紀錄時預設為空陣列', () => {
    const project = createProjectFile(nodes, edges, messages)
    const legacyProject = { ...project } as Partial<typeof project>
    delete legacyProject.suggestionEvents

    expect(parseProjectFile(legacyProject).suggestionEvents).toEqual([])
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
        startTimeMs: 1_000,
        endTimeMs: 5_000,
      },
    }

    const imported = parseProjectFile(
      createProjectFile(
        [videoNode, secondVideo, timedNode],
        [{ id: 'video-link', source: 'video-2', target: timedNode.id, data: { origin: 'user' } }],
        [],
      ),
    )

    expect(imported.nodes.filter((node) => node.type === 'video')).toHaveLength(2)
    expect(imported.nodes[2]?.data).toMatchObject({
      startTimeMs: 1_000,
      endTimeMs: 5_000,
    })
    expect(imported.edges).toContainEqual(
      expect.objectContaining({ source: 'video-2', target: timedNode.id }),
    )
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

    expect(imported.version).toBe(4)
    expect(migratedVideo?.data.title).toBe('舊影片')
    expect(imported.edges).toContainEqual(
      expect.objectContaining({ source: migratedVideo?.id, target: 'node-1' }),
    )
  })

  it('自動將 version 1 舊專案升級為 version 4', () => {
    const imported = parseProjectFile({
      ...createProjectFile(nodes, edges, messages),
      version: 1,
    })

    expect(imported.version).toBe(4)
  })

  it('拒絕未連接影片與超出影片長度的區間', () => {
    const missingVideoNode: ConceptCanvasNode = {
      ...nodes[0]!,
      data: {
        ...nodes[0]!.data,
        startTimeMs: 1_000,
        endTimeMs: 2_000,
      },
    }
    const nodePastDuration: ConceptCanvasNode = {
      ...nodes[0]!,
      data: {
        ...nodes[0]!.data,
        startTimeMs: 59_000,
        endTimeMs: 61_000,
      },
    }

    expect(() =>
      parseProjectFile(createProjectFile([missingVideoNode], [], [])),
    ).toThrow('設定節點時間前必須先連接影片節點')
    expect(() =>
      parseProjectFile(createProjectFile(
        [videoNode, nodePastDuration],
        [{ id: 'video-link', source: videoNode.id, target: nodePastDuration.id, data: { origin: 'user' } }],
        [],
      )),
    ).toThrow('節點時間不得超出影片長度')
  })

  it('自動將 version 3 的影片欄位轉換為連線', () => {
    const imported = parseProjectFile({
      version: 3,
      nodes: [
        videoNode,
        {
          ...nodes[0],
          data: { ...nodes[0].data, mediaNodeId: videoNode.id, startTimeMs: 1_000, endTimeMs: 2_000 },
        },
      ],
      edges: [],
      messages: [],
      exportedAt: '2026-08-14T00:00:00.000Z',
    })

    expect(imported.version).toBe(4)
    expect(imported.nodes[1]?.data).not.toHaveProperty('mediaNodeId')
    expect(imported.edges).toContainEqual(
      expect.objectContaining({ source: videoNode.id, target: 'node-1' }),
    )
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
