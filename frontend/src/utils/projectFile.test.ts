import { describe, expect, it } from 'vitest'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import type { ChatMessage } from '../types/chat'
import {
  createProjectFile,
  parseProjectFile,
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

describe('projectFile', () => {
  it('匯出時排除孤兒對話', () => {
    const project = createProjectFile(nodes, edges, messages)

    expect(project.version).toBe(1)
    expect(project.messages.map((message) => message.id)).toEqual([
      'message-1',
    ])
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
})
