import { z } from 'zod'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import type { ChatMessage } from '../types/chat'

const originSchema = z.enum(['user', 'ai'])

const canvasNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('concept'),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  data: z.object({
    title: z.string(),
    content: z.string(),
    origin: originSchema,
  }),
})

const canvasEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  data: z.object({
    label: z.string().optional(),
    origin: originSchema,
  }).optional(),
})

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'ai']),
  content: z.string(),
  contextNodeId: z.string().nullable(),
  createdAt: z.string(),
  canGenerateNodes: z.boolean().optional(),
  latencyMs: z.number().nonnegative().optional(),
  isError: z.boolean().optional(),
  retryAction: z.enum(['chat', 'suggestion']).optional(),
  retryContent: z.string().optional(),
})

export const projectFileSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  nodes: z.array(canvasNodeSchema),
  edges: z.array(canvasEdgeSchema),
  messages: z.array(chatMessageSchema),
}).superRefine((project, context) => {
  const nodeIds = new Set(project.nodes.map((node) => node.id))

  project.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      context.addIssue({
        code: 'custom',
        path: ['edges', index],
        message: '連線引用了不存在的節點',
      })
    }
  })

})

export type ProjectFile = {
  version: 1
  exportedAt: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  messages: ChatMessage[]
}

export function createProjectFile(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  messages: ChatMessage[],
): ProjectFile {
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    nodes: nodes.map((node) => ({
      id: node.id,
      type: 'concept',
      position: node.position,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined,
      data: edge.data,
    })),
    messages: messages.filter(
      (message) =>
        message.contextNodeId === null ||
        nodeIds.has(message.contextNodeId),
    ),
  }
}

export function parseProjectFile(value: unknown): ProjectFile {
  const project = projectFileSchema.parse(value)
  const nodeIds = new Set(project.nodes.map((node) => node.id))

  return {
    ...project,
    messages: project.messages.filter(
      (message) =>
        message.contextNodeId === null ||
        nodeIds.has(message.contextNodeId),
    ),
  } as ProjectFile
}

export function downloadFile(
  content: BlobPart,
  fileName: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
