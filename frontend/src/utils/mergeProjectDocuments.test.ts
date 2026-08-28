import { describe, expect, it } from 'vitest'
import type { ProjectDocument } from '../types/project'
import { mergeProjectDocuments } from './mergeProjectDocuments'

function document(): ProjectDocument {
  return {
    version: 4,
    nodes: [
      {
        id: 'node-1',
        type: 'concept',
        position: { x: 0, y: 0 },
        data: {
          title: '原始標題',
          content: '原始內容',
          origin: 'user',
        },
      },
    ],
    edges: [],
    messages: [],
    suggestionEvents: [],
  }
}

describe('mergeProjectDocuments', () => {
  it('保留本機修改並加入遠端新增內容', () => {
    const base = document()
    const local = structuredClone(base)
    const remote = structuredClone(base)
    local.nodes[0].data.title = '本機標題'
    remote.nodes.push({
      id: 'node-2',
      type: 'concept',
      position: { x: 200, y: 0 },
      data: { title: '遠端節點', content: '', origin: 'user' },
    })

    const merged = mergeProjectDocuments(base, local, remote)

    expect(merged.nodes).toHaveLength(2)
    expect(merged.nodes[0].data.title).toBe('本機標題')
    expect(merged.nodes[1].data.title).toBe('遠端節點')
  })

  it('合併同一節點不同欄位的同步修改', () => {
    const base = document()
    const local = structuredClone(base)
    const remote = structuredClone(base)
    const localNode = local.nodes[0]
    const remoteNode = remote.nodes[0]
    if (localNode.type !== 'concept' || remoteNode.type !== 'concept') {
      throw new Error('測試節點型別錯誤')
    }
    localNode.data.title = '本機標題'
    remoteNode.data.content = '遠端內容'

    expect(
      mergeProjectDocuments(base, local, remote).nodes[0].data,
    ).toMatchObject({
      title: '本機標題',
      content: '遠端內容',
    })
  })

  it('合併兩位協作者各自新增的對話', () => {
    const base = document()
    const local = structuredClone(base)
    const remote = structuredClone(base)
    local.messages.push({
      id: 'message-local',
      role: 'user',
      content: '本機訊息',
      contextNodeId: 'node-1',
      createdAt: '2026-08-28T00:00:00.000Z',
      authorId: 'local-user',
      authorEmail: 'local@example.com',
      authorName: '本機協作者',
    })
    remote.messages.push({
      id: 'message-remote',
      role: 'user',
      content: '遠端訊息',
      contextNodeId: 'node-1',
      createdAt: '2026-08-28T00:00:01.000Z',
      authorId: 'remote-user',
      authorEmail: 'remote@example.com',
      authorName: '遠端協作者',
    })

    const merged = mergeProjectDocuments(base, local, remote)

    expect(merged.messages.map((message) => message.id)).toEqual([
      'message-local',
      'message-remote',
    ])
  })
})
