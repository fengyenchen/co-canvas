import { z } from 'zod'
import type { CanvasEdge, CanvasNode } from '../types/canvas'
import type { ChatMessage } from '../types/chat'
import type { ProjectDocument } from '../types/project'
import type { SuggestionDecisionEvent } from '../types/suggestion'

const originSchema = z.enum(['user', 'ai'])
const conceptNodeColorSchema = z.enum([
  'default',
  'yellow',
  'pink',
  'blue',
  'green',
  'purple',
])
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
    color: conceptNodeColorSchema.default('default'),
    startTimeMs: optionalNonnegativeIntegerSchema,
    endTimeMs: optionalNonnegativeIntegerSchema,
    documentStartPage: z.preprocess(nullToUndefined, z.number().int().positive().optional()),
    documentEndPage: z.preprocess(nullToUndefined, z.number().int().positive().optional()),
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

    const hasStartPage = data.documentStartPage !== undefined
    const hasEndPage = data.documentEndPage !== undefined
    if (hasStartPage !== hasEndPage) {
      context.addIssue({
        code: 'custom',
        path: hasStartPage ? ['documentEndPage'] : ['documentStartPage'],
        message: '文件開始與結束頁必須同時設定',
      })
    } else if (
      data.documentStartPage !== undefined &&
      data.documentEndPage !== undefined &&
      data.documentEndPage < data.documentStartPage
    ) {
      context.addIssue({ code: 'custom', path: ['documentEndPage'], message: '文件結束頁不得早於開始頁' })
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

const fileNodeDataSchema = z.object({
  ...commonNodeDataShape,
  fileName: optionalStringSchema,
  mimeType: optionalStringSchema,
  size: z.preprocess(nullToUndefined, z.number().int().nonnegative().optional()),
  source: optionalStringSchema,
  pageCount: z.preprocess(nullToUndefined, z.number().int().positive().optional()),
  pageUnit: z.preprocess(nullToUndefined, z.enum(['page', 'slide']).optional()),
})

const groupNodeDataSchema = z.object({
  title: z.string().max(120),
  width: z.number().finite().min(240).max(10000),
  height: z.number().finite().min(160).max(10000),
  color: conceptNodeColorSchema.default('default'),
  collapsed: z.boolean().default(false),
  locked: z.boolean().default(false),
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
  parentId: optionalStringSchema,
})

const videoNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('video'),
  position: positionSchema,
  data: videoNodeDataSchema,
  parentId: optionalStringSchema,
})

const documentNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('document'),
  position: positionSchema,
  data: fileNodeDataSchema,
  parentId: optionalStringSchema,
})

const imageNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('image'),
  position: positionSchema,
  data: fileNodeDataSchema,
  parentId: optionalStringSchema,
})

const groupNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('group'),
  position: positionSchema,
  data: groupNodeDataSchema,
})

const canvasNodeSchema = z.discriminatedUnion('type', [
  conceptNodeSchema,
  videoNodeSchema,
  documentNodeSchema,
  imageNodeSchema,
  groupNodeSchema,
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
  authorId: optionalStringSchema,
  authorEmail: optionalStringSchema,
  authorName: optionalStringSchema,
  canGenerateNodes: optionalBooleanSchema,
  latencyMs: optionalNonnegativeNumberSchema,
  isError: optionalBooleanSchema,
  retryAction: z.preprocess(
    nullToUndefined,
    z.enum(['chat', 'suggestion']).optional(),
  ),
  retryContent: optionalStringSchema,
})

const suggestionDecisionEventSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['accepted', 'rejected', 'regenerated']),
  contextNodeId: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  aiMode: z.enum(['gemini', 'mock']),
  edited: z.boolean(),
  decisionTimeMs: z.number().int().nonnegative(),
  nodeCount: z.number().int().nonnegative().max(8),
  createdAt: z.string(),
})

const projectDocumentShape = {
  version: z.literal(4),
  nodes: z.array(canvasNodeSchema),
  edges: z.array(canvasEdgeSchema),
  messages: z.array(chatMessageSchema),
  suggestionEvents: z.array(suggestionDecisionEventSchema).default([]),
}

const projectDocumentV4Schema = z.object(projectDocumentShape)

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

  const normalized = value as Record<string, unknown>
  const normalizedNodes = Array.isArray(normalized.nodes)
    ? normalized.nodes.map((node) =>
        typeof node === 'object' && node !== null && 'type' in node && node.type === 'file'
          ? { ...node, type: 'document' }
          : node,
      )
    : normalized.nodes
  const candidate: Record<string, unknown> = { ...normalized, nodes: normalizedNodes }

  if (candidate.version === 1) {
    return { ...candidate, version: 4 }
  }

  if (candidate.version === 3) {
    const legacy = candidate
    const nodes = Array.isArray(legacy.nodes) ? legacy.nodes : []
    const edges = Array.isArray(legacy.edges) ? [...legacy.edges] : []
    const edgeIds = new Set(
      edges.flatMap((edge) =>
        typeof edge === 'object' && edge !== null && 'id' in edge &&
        typeof edge.id === 'string' ? [edge.id] : [],
      ),
    )
    const migratedNodes = nodes.map((node) => {
      if (typeof node !== 'object' || node === null) return node
      const record = node as Record<string, unknown>
      if (record.type !== 'concept' || typeof record.data !== 'object' || record.data === null) {
        return node
      }
      const data = record.data as Record<string, unknown>
      const mediaNodeId = data.mediaNodeId ?? data.media_node_id
      const { mediaNodeId: _camel, media_node_id: _snake, ...nextData } = data
      void _camel
      void _snake

      if (typeof mediaNodeId === 'string') {
        const alreadyLinked = edges.some(
          (edge) => typeof edge === 'object' && edge !== null &&
            'source' in edge && edge.source === mediaNodeId &&
            'target' in edge && edge.target === record.id,
        )
        if (!alreadyLinked) {
          let edgeId = `migrated-video-link-${String(record.id)}`
          let suffix = 1
          while (edgeIds.has(edgeId)) {
            suffix += 1
            edgeId = `migrated-video-link-${String(record.id)}-${suffix}`
          }
          edgeIds.add(edgeId)
          edges.push({
            id: edgeId,
            source: mediaNodeId,
            target: record.id,
            data: { origin: 'user' },
          })
        }
      }

      return { ...record, data: nextData }
    })

    return { ...legacy, version: 4, nodes: migratedNodes, edges }
  }

  if (candidate.version !== 2) {
    return candidate
  }

  const legacy = candidate
  const nodes = Array.isArray(legacy.nodes) ? legacy.nodes : []
  const media = legacy.media

  if (typeof media !== 'object' || media === null) {
    const document = { ...legacy }
    delete document.media
    return { ...document, version: 4 }
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
  const migratedEdges = Array.isArray(legacy.edges) ? [...legacy.edges] : []
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null) continue
    const record = node as Record<string, unknown>
    if (record.type !== 'concept' || typeof record.data !== 'object' || record.data === null) continue
    const data = record.data as Record<string, unknown>
    const hasTime = data.startTimeMs !== undefined || data.endTimeMs !== undefined
    if (hasTime && typeof record.id === 'string') {
      migratedEdges.push({
        id: `migrated-video-link-${record.id}`,
        source: videoNodeId,
        target: record.id,
        data: { origin: 'user' },
      })
    }
  }
  const document = { ...legacy }
  delete document.media

  return {
    ...document,
    version: 4,
    nodes: [
      ...nodes,
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
    edges: migratedEdges,
  }
}

function validateProjectRelations(
  project: z.infer<typeof projectDocumentV4Schema>,
  context: z.core.$RefinementCtx,
) {
  const nodeIds = new Set(project.nodes.map((node) => node.id))
  const videoNodes = new Map(
    project.nodes
      .filter((node) => node.type === 'video')
      .map((node) => [node.id, node]),
  )
  const documentNodes = new Map(
    project.nodes
      .filter((node): node is Extract<CanvasNode, { type: 'document' }> => node.type === 'document')
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
    if (node.type !== 'group' && node.parentId !== undefined) {
      const parent = project.nodes.find(
        (candidate) => candidate.id === node.parentId,
      )
      if (!parent || parent.type !== 'group') {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'parentId'],
          message: '群組成員引用了不存在的群組',
        })
      }
    }

    if (node.type !== 'concept') return
    const { startTimeMs, endTimeMs, documentStartPage, documentEndPage } = node.data

    if (documentStartPage !== undefined && documentEndPage !== undefined) {
      const linkedDocumentIds = [...new Set(
        project.edges
          .filter((edge) => edge.target === node.id && documentNodes.has(edge.source))
          .map((edge) => edge.source),
      )]
      if (linkedDocumentIds.length !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'data', 'documentStartPage'],
          message: linkedDocumentIds.length === 0
            ? '設定頁面範圍前必須先連接文件節點'
            : '設定頁面範圍的文字節點只能連接一個文件節點',
        })
      } else {
        const pageCount = documentNodes.get(linkedDocumentIds[0])?.data.pageCount
        if (pageCount !== undefined && documentEndPage > pageCount) {
          context.addIssue({ code: 'custom', path: ['nodes', index, 'data', 'documentEndPage'], message: '文件結束頁不得超出文件頁數' })
        }
      }
    }

    if (startTimeMs === undefined || endTimeMs === undefined) return

    const linkedVideoIds = [...new Set(
      project.edges
        .filter((edge) => edge.target === node.id && videoNodes.has(edge.source))
        .map((edge) => edge.source),
    )]

    if (linkedVideoIds.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'data', 'startTimeMs'],
        message: '設定節點時間前必須先連接影片節點',
      })
      return
    }

    if (linkedVideoIds.length > 1) {
      context.addIssue({
        code: 'custom',
        path: ['nodes', index, 'data', 'startTimeMs'],
        message: '設定時間區間的文字節點只能連接一個影片節點',
      })
      return
    }

    const durationMs = videoNodes.get(linkedVideoIds[0])?.data.durationMs
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
  projectDocumentV4Schema.superRefine(validateProjectRelations),
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
  suggestionEvents: SuggestionDecisionEvent[] = [],
): ProjectFile {
  return {
    ...createProjectDocument(nodes, edges, messages, suggestionEvents),
    exportedAt: new Date().toISOString(),
  }
}

export function createProjectDocument(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  messages: ChatMessage[],
  suggestionEvents: SuggestionDecisionEvent[] = [],
): ProjectDocument {
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    version: 4,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      ...(node.type !== 'group' && node.parentId
        ? { parentId: node.parentId }
        : {}),
      data: node.type === 'concept'
        ? { ...node.data, color: node.data.color ?? 'default' }
        : node.type === 'group'
          ? {
              ...node.data,
              color: node.data.color ?? 'default',
              collapsed: node.data.collapsed ?? false,
              locked: node.data.locked ?? false,
            }
          : node.data,
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
    suggestionEvents,
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
