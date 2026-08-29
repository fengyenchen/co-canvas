import { describe, expect, it } from 'vitest'
import { createExampleProjectDocument } from './exampleProject'
import { projectDocumentSchema } from './projectFile'

describe('exampleProject', () => {
  it('建立包含文字節點、模擬對話與產生節點入口的範例文件', () => {
    const document = createExampleProjectDocument()
    const parsed = projectDocumentSchema.parse(document)

    expect(parsed.nodes).toHaveLength(4)
    expect(parsed.nodes.every((node) => node.type === 'concept')).toBe(true)
    expect(parsed.edges).toHaveLength(3)
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages.at(-1)?.canGenerateNodes).toBe(true)
  })
})
