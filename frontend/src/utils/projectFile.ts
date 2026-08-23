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
const optionalNonnegativeIntegerSchema = z.preprocess(
  nullToUndefined,
  z.number().int().nonnegative().optional(),
)

const commonNodeDataShape = {
  title: z.string(),
  content: z.string(),
  origin: originSchema,
}

const conceptNodeDataSchema = z
  .object({
    ...commonNodeDataShape,
    mediaNodeId: optionalStringSchema,
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

const videoNodeDataSchema = z.object({
  ...commonNodeDataShape,
  sourceType: z.literal('url'),
  source: z.string().refine(
    (source) => {
      if (!source) return true

      try {
      const protocol = new URL(source).protocol
      return protocol === 'http:' || protocol === 'https:'
      } catch {
        return false
      }
    },
    '影片網址必須為空白或使用 http、https',
  ),
  durationMs: z.preprocess(
    nullToUndefined,
    z.number().int().positive().optional(),
  ),
})

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
})

const conceptNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('concept'),
  position: positionSchema,
  data: conceptNodeDataSchema,
})

const videoNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('video'),
  position: positionSchema,
  data: videoNodeDataSchema,
})

const canvasNodeSchema = z.discriminatedUnion('type', [
  conceptNodeSchema,
  videoNodeSchema,
])

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
  version: z.literal(3),
  nodes: z.array(canvasNodeSchema),
  edges: z.array(canvasEdgeSchema),
  messages: z.array(chatMessageSchema),
}

const projectDocumentV3Schema = z.object(projectDocumentShape)

function createLegacyVideoNodeId(nodes: unknown[]): string {
  const nodeIds = new Set(
    nodes.flatMap((node) =>
      typeof node === 'object' && node !== null && 'id' in node &&
      typeof node.id === 'string'
        ? [node.id]
        : [],
    ),
  )
  let suffix = 1
  let candidate = 'legacy-video'

  while (nodeIds.has(candidate)) {
    suffix += 1
    candidate = `legacy-video-${suffix}`
  }

  return candidate
}

function upgradeLegacyProject(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !('version' in value)) {
    return value
  }

  if (value.version === 1) {
    return { ...value, version: 3 }
  }

  if (value.version !== 2) {
    return value
  }

  const legacy = value as Record<string, unknown>
  const nodes = Array.isArray(legacy.nodes) ? legacy.nodes : []
  const media = legacy.media

  if (typeof media !== 'object' || media === null) {
    const document = { ...legacy }
    delete document.media
    return { ...document, version: 3 }
  }

  const mediaRecord = media as Record<string, unknown>
  const videoNodeId = createLegacyVideoNodeId(nodes)
  const minY = nodes.reduce((minimum, node) => {
    if (
      typeof node === 'object' && node !== null && 'position' in node &&
      typeof node.position === 'object' && node.position !== null &&
      'y' in node.position && typeof node.position.y === 'number'
    ) {
      return Math.min(minimum, node.position.y)
    }
    return minimum
  }, 100)
  const migratedNodes = nodes.map((node) => {
    if (typeof node !== 'object' || node === null) return node
    const record = node as Record<string, unknown>
    if (record.type !== 'concept' || typeof record.data !== 'object' || record.data === null) {
      return node
    }
    const data = record.data as Record<string, unknown>
    const hasTime = data.startTimeMs !== undefined || data.endTimeMs !== undefined
    return hasTime && data.mediaNodeId === undefined
      ? { ...record, data: { ...data, mediaNodeId: videoNodeId } }
      : node
  })
  const document = { ...legacy }
  delete document.media

  return {
    ...document,
    version: 3,
    nodes: [
      ...migratedNodes,
      {
        id: videoNodeId,
        type: 'video',
        position: { x: 0, y: minY - 220 },
        data: {
          title:
            typeof mediaRecord.title === 'string' && mediaRecord.title
              ? mediaRecord.title
              : '影片',
          content: '',
          origin: 'user',
          sourceType: mediaRecord.sourceType ?? 'url',
          source: mediaRecord.source,
          ...(mediaRecord.durationMs !== undefined
            ? { durationMs: mediaRecord.durationMs }
            : {}),
        },
      },
    ],
  }
}

function validateProjectRelations(
  project: z.infer<typeof projectDocumentV3Schema>,
  context: z.core.$RefinementCtx,
) {
  const nodeIds = new Set(project.nodes.map((node) => node.id))
  const videoNodes = new Map(
    project.nodes
      .filter((node) => node.type === 'video')
      .map((node) => [node.id, node]),
  )

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
    if (node.type !== 'concept') return
    const { mediaNodeId, startTimeMs, endTimeMs } = node.data

    if (mediaNodeId !== undefined && !videoNodes.has(mediaNodeId)) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'data', 'mediaNodeId'],
        message: '節點引用了不存在的影片節點',
      })
      return
    }

    if (startTimeMs === undefined || endTimeMs === undefined) return

    if (!mediaNodeId) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'data', 'mediaNodeId'],
        message: '設定節點時間前必須指定影片節點',
      })
      return
    }

    const durationMs = videoNodes.get(mediaNodeId)?.data.durationMs
    if (durationMs !== undefined && endTimeMs > durationMs) {
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
  projectDocumentV3Schema.superRefine(validateProjectRelations),
)

export const projectFileSchema = z.preprocess(
  upgradeLegacyProject,
  z.object({
    ...projectDocumentShape,
    exportedAt: z.string(),
  }).superRefine(validateProjectRelations),
)

export type ProjectFile = ProjectDocument & { exportedAt: string }

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
    version: 3,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })) as CanvasNode[],
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined,
      data: edge.data,
    })),
    messages: messages.filter(
      (message) =>
        message.contextNodeId === null || nodeIds.has(message.contextNodeId),
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
        message.contextNodeId === null || nodeIds.has(message.contextNodeId),
    ),
  } as ProjectFile
}

export function downloadFile(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
