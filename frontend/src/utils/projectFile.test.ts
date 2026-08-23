import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import type { ChatMessage } from '../types/chat'
import type { ProjectMedia } from '../types/project'
import {
  createProjectFile,
  parseProjectFile,
  projectDocumentSchema,
} from './projectFile'

const nodes: CanvasNode[] = [
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
    data: {
      label: '延伸',
      origin: 'ai',
    },
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

const media: ProjectMedia = {
  type: 'video',
  sourceType: 'url',
  source: 'https://example.com/video.mp4',
  title: '研究影片',
  durationMs: 60_000,
}

describe('projectFile', () => {
  it('匯出時排除孤兒對話', () => {
    const project = createProjectFile(nodes, edges, messages)

    expect(project.version).toBe(2)
    expect(project.messages.map((message) => message.id)).toEqual([
      'message-1',
    ])
  })

  it('保留影片與節點時間區間', () => {
    const timedNodes: CanvasNode[] = [
      {
        ...nodes[0]!,
        data: {
          ...nodes[0]!.data,
          startTimeMs: 1_000,
          endTimeMs: 5_000,
        },
      },
    ]

    const project = createProjectFile(timedNodes, [], [], media)
    const importedProject = parseProjectFile(project)

    expect(importedProject.media).toEqual(media)
    expect(importedProject.nodes[0]?.data.startTimeMs).toBe(1_000)
    expect(importedProject.nodes[0]?.data.endTimeMs).toBe(5_000)
  })

  it('自動將 version 1 舊專案升級為 version 2', () => {
    const legacyProject = {
      ...createProjectFile(nodes, edges, messages),
      version: 1,
    }

    const importedProject = parseProjectFile(legacyProject)

    expect(importedProject.version).toBe(2)
    expect(importedProject.media).toBeUndefined()
  })

  it('拒絕不完整或超出影片長度的節點時間', () => {
    const nodeWithOnlyStartTime = {
      ...nodes[0]!,
      data: {
        ...nodes[0]!.data,
        startTimeMs: 1_000,
      },
    }
    const nodePastVideoDuration = {
      ...nodes[0]!,
      data: {
        ...nodes[0]!.data,
        startTimeMs: 59_000,
        endTimeMs: 61_000,
      },
    }

    expect(() =>
      createProjectFile([nodeWithOnlyStartTime], [], [], media),
    ).not.toThrow()
    expect(() =>
      parseProjectFile(
        createProjectFile([nodeWithOnlyStartTime], [], [], media),
      ),
    ).toThrow('開始與結束時間必須同時設定')
    expect(() =>
      parseProjectFile(
        createProjectFile([nodePastVideoDuration], [], [], media),
      ),
    ).toThrow('節點時間不得超出影片長度')
  })

  it('匯出的資料可以再次匯入', () => {
    const exportedProject = createProjectFile(nodes, edges, messages)
    const importedProject = parseProjectFile(
      JSON.parse(JSON.stringify(exportedProject)),
    )

    expect(importedProject.nodes).toEqual(exportedProject.nodes)
    expect(importedProject.edges).toEqual(exportedProject.edges)
    expect(importedProject.messages).toEqual(exportedProject.messages)
  })

  it('匯入舊檔案時安全忽略孤兒對話', () => {
    const projectWithOrphanMessage = {
      ...createProjectFile(nodes, edges, []),
      messages,
    }

    const importedProject = parseProjectFile(projectWithOrphanMessage)

    expect(importedProject.messages).toHaveLength(1)
    expect(importedProject.messages[0]?.id).toBe('message-1')
  })

  it('拒絕引用不存在節點的連線', () => {
    const invalidProject = {
      ...createProjectFile(nodes, [], []),
      edges: [
        {
          id: 'invalid-edge',
          source: 'node-1',
          target: 'missing-node',
          data: { origin: 'user' },
        },
      ],
    }

    expect(() => parseProjectFile(invalidProject)).toThrow(
      '連線引用了不存在的節點',
    )
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
