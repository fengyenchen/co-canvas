import { z } from 'zod'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import type { ChatMessage } from '../types/chat'
import type { ProjectDocument } from '../types/project'

const originSchema = z.enum(['user', 'ai'])
const nullToUndefined = (value: unknown) =>
  value === null ? undefined : value
const optionalStringSchema = z.preprocess(
  nullToUndefined,
  z.string().optional(),
)
const optionalBooleanSchema = z.preprocess(
  nullToUndefined,
  z.boolean().optional(),
)
const optionalNonnegativeNumberSchema = z.preprocess(
  nullToUndefined,
  z.number().nonnegative().optional(),
)

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
  label: optionalStringSchema,
  data: z.preprocess(
    nullToUndefined,
    z
      .object({
        label: optionalStringSchema,
        origin: originSchema,
      })
      .optional(),
  ),
})

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'ai']),
  content: z.string(),
  contextNodeId: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  createdAt: z.string(),
  canGenerateNodes: optionalBooleanSchema,
  latencyMs: optionalNonnegativeNumberSchema,
  isError: optionalBooleanSchema,
  retryAction: z.preprocess(
    nullToUndefined,
    z.enum(['chat', 'suggestion']).optional(),
  ),
  retryContent: optionalStringSchema,
})

const projectDocumentShape = {
  version: z.literal(1),
  nodes: z.array(canvasNodeSchema),
  edges: z.array(canvasEdgeSchema),
  messages: z.array(chatMessageSchema),
}

function validateProjectRelations(
  project: z.infer<typeof projectDocumentSchema>,
  context: z.core.$RefinementCtx,
) {
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
}

export const projectDocumentSchema = z
  .object(projectDocumentShape)
  .superRefine(validateProjectRelations)

export const projectFileSchema = z
  .object({
    ...projectDocumentShape,
    exportedAt: z.string(),
  })
  .superRefine(validateProjectRelations)

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
  return {
    ...createProjectDocument(nodes, edges, messages),
    exportedAt: new Date().toISOString(),
  }
}

export function createProjectDocument(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  messages: ChatMessage[],
): ProjectDocument {
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    version: 1,
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
