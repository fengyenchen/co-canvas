import type { ProjectDocument } from '../types/project'

type Identified = { id: string }
type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function mergeRecord(
  base: JsonRecord,
  local: JsonRecord,
  remote: JsonRecord,
): JsonRecord {
  const result: JsonRecord = {}
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])

  keys.forEach((key) => {
    const baseHas = Object.hasOwn(base, key)
    const localHas = Object.hasOwn(local, key)
    const remoteHas = Object.hasOwn(remote, key)

    if (!localHas) {
      if (!baseHas && remoteHas) result[key] = remote[key]
      if (baseHas && remoteHas && !isEqual(remote[key], base[key])) {
        // A local property deletion wins over a simultaneous remote edit.
        return
      }
      return
    }

    if (!remoteHas) {
      if (!baseHas || !isEqual(local[key], base[key])) result[key] = local[key]
      return
    }

    result[key] = mergeValue(base[key], local[key], remote[key])
  })

  return result
}

function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (isEqual(local, remote)) return local
  if (isEqual(local, base)) return remote
  if (isEqual(remote, base)) return local

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    return mergeRecord(base, local, remote)
  }

  // Both clients changed the same scalar field. Keep the current user's edit.
  return local
}

function mergeEntities<T extends Identified>(
  baseItems: T[],
  localItems: T[],
  remoteItems: T[],
): T[] {
  const base = new Map(baseItems.map((item) => [item.id, item]))
  const local = new Map(localItems.map((item) => [item.id, item]))
  const remote = new Map(remoteItems.map((item) => [item.id, item]))
  const orderedIds = [
    ...remoteItems.map((item) => item.id),
    ...localItems
      .map((item) => item.id)
      .filter((id) => !remote.has(id)),
  ]

  return orderedIds.flatMap((id) => {
    const baseItem = base.get(id)
    const localItem = local.get(id)
    const remoteItem = remote.get(id)

    if (!localItem) {
      if (!baseItem && remoteItem) return [remoteItem]
      if (
        baseItem &&
        remoteItem &&
        !isEqual(remoteItem, baseItem)
      ) {
        return []
      }
      return []
    }

    if (!remoteItem) {
      if (!baseItem || !isEqual(localItem, baseItem)) return [localItem]
      return []
    }

    if (!baseItem) {
      return [isEqual(localItem, remoteItem)
        ? localItem
        : mergeRecord({}, localItem, remoteItem) as T]
    }

    return [mergeValue(baseItem, localItem, remoteItem) as T]
  })
}

export function mergeProjectDocuments(
  base: ProjectDocument,
  local: ProjectDocument,
  remote: ProjectDocument,
): ProjectDocument {
  const mergedNodes = mergeEntities(base.nodes, local.nodes, remote.nodes)
  const initialNodeIds = new Set(mergedNodes.map((node) => node.id))
  const nodes = mergedNodes.map((node) =>
    node.parentId && !initialNodeIds.has(node.parentId)
      ? { ...node, parentId: undefined }
      : node,
  )
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    version: 4,
    nodes,
    edges: mergeEntities(base.edges, local.edges, remote.edges)
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
    messages: mergeEntities(
      base.messages,
      local.messages,
      remote.messages,
    )
      .filter(
        (message) =>
          message.contextNodeId === null || nodeIds.has(message.contextNodeId),
      )
      .sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
      ),
    suggestionEvents: mergeEntities(
      base.suggestionEvents,
      local.suggestionEvents,
      remote.suggestionEvents,
    ),
  }
}
