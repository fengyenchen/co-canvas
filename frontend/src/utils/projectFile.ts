import { z } from 'zod'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import type { ChatMessage } from '../types/chat'
import type { ProjectDocument, ProjectMedia } from '../types/project'

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
const optionalNonnegativeIntegerSchema = z.preprocess(
  nullToUndefined,
  z.number().int().nonnegative().optional(),
)

const canvasNodeDataSchema = z
  .object({
    title: z.string(),
    content: z.string(),
    origin: originSchema,
    startTimeMs: optionalNonnegativeIntegerSchema,
    endTimeMs: optionalNonnegativeIntegerSchema,
  })
  .superRefine((data, context) => {
    const hasStartTime = data.startTimeMs !== undefined
    const hasEndTime = data.endTimeMs !== undefined

    if (hasStartTime !== hasEndTime) {
      context.addIssue({
        code: 'custom',
        path: hasStartTime ? ['endTimeMs'] : ['startTimeMs'],
        message: '開始與結束時間必須同時設定',
      })
      return
    }

    if (
      data.startTimeMs !== undefined &&
      data.endTimeMs !== undefined &&
      data.endTimeMs <= data.startTimeMs
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endTimeMs'],
        message: '結束時間必須晚於開始時間',
      })
    }
  })

const canvasNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('concept'),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  data: canvasNodeDataSchema,
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

const projectMediaSchema = z.object({
  type: z.literal('video'),
  sourceType: z.literal('url'),
  source: z.string().url().refine(
    (source) => {
      const protocol = new URL(source).protocol
      return protocol === 'http:' || protocol === 'https:'
    },
    '影片網址必須使用 http 或 https',
  ),
  title: optionalStringSchema,
  durationMs: z.preprocess(
    nullToUndefined,
    z.number().int().positive().optional(),
  ),
})

const projectDocumentShape = {
  version: z.literal(2),
  media: z.preprocess(
    nullToUndefined,
    projectMediaSchema.optional(),
  ),
  nodes: z.array(canvasNodeSchema),
  edges: z.array(canvasEdgeSchema),
  messages: z.array(chatMessageSchema),
}

const projectDocumentV2Schema = z.object(projectDocumentShape)

function upgradeLegacyProject(value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1
  ) {
    return {
      ...value,
      version: 2,
    }
  }

  return value
}

function validateProjectRelations(
  project: z.infer<typeof projectDocumentV2Schema>,
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

  project.nodes.forEach((node, index) => {
    const { startTimeMs, endTimeMs } = node.data

    if (startTimeMs === undefined || endTimeMs === undefined) {
      return
    }

    if (!project.media) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'data', 'startTimeMs'],
        message: '設定節點時間前必須先設定影片',
      })
      return
    }

    if (
      project.media.durationMs !== undefined &&
      endTimeMs > project.media.durationMs
    ) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'data', 'endTimeMs'],
        message: '節點時間不得超出影片長度',
      })
    }
  })
}

export const projectDocumentSchema = z.preprocess(
  upgradeLegacyProject,
  projectDocumentV2Schema.superRefine(validateProjectRelations),
)

export const projectFileSchema = z.preprocess(
  upgradeLegacyProject,
  z
    .object({
      ...projectDocumentShape,
      exportedAt: z.string(),
    })
    .superRefine(validateProjectRelations),
)

export type ProjectFile = {
  version: 2
  exportedAt: string
  media?: ProjectMedia
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  messages: ChatMessage[]
}

export function createProjectFile(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  messages: ChatMessage[],
  media?: ProjectMedia,
): ProjectFile {
  return {
    ...createProjectDocument(nodes, edges, messages, media),
    exportedAt: new Date().toISOString(),
  }
}

export function createProjectDocument(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  messages: ChatMessage[],
  media?: ProjectMedia,
): ProjectDocument {
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    version: 2,
    media,
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
