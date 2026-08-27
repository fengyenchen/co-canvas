import type { AiContextNode } from '../types/aiContext'
import type { CanvasEdge, CanvasNode, VideoCanvasNode } from '../types/canvas'

function getVideoProvider(source: string): string {
  try {
    const hostname = new URL(source).hostname.toLowerCase().replace(/^www\./, '')

    if (hostname === 'youtu.be' || hostname.endsWith('youtube.com')) {
      return 'YouTube'
    }
    if (hostname === 'vimeo.com' || hostname === 'player.vimeo.com') {
      return 'Vimeo'
    }
    if (hostname.endsWith('bilibili.com')) return 'Bilibili'
    if (hostname === 'dropbox.com' || hostname.endsWith('.dropbox.com')) {
      return 'Dropbox'
    }
    return '直接影片網址'
  } catch {
    return source ? '直接影片網址' : '尚未設定'
  }
}

function findLinkedVideo(
  nodeId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): VideoCanvasNode | undefined {
  const videoNodeIds = new Set(
    nodes.filter((node) => node.type === 'video').map((node) => node.id),
  )
  const videoNodeId = edges.find(
    (edge) => edge.target === nodeId && videoNodeIds.has(edge.source),
  )?.source

  return nodes.find(
    (node): node is VideoCanvasNode =>
      node.type === 'video' && node.id === videoNodeId,
  )
}

export function createAiContextNode(
  node: CanvasNode,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
): AiContextNode {
  if (node.type === 'group') {
    throw new Error('群組框不能作為 AI 對話上下文')
  }

  const base = {
    id: node.id,
    title: node.data.title,
    content: node.data.content,
    nodeType: node.type,
  } as const

  if (node.type === 'video') {
    return {
      ...base,
      videoProvider: getVideoProvider(node.data.source),
      ...(node.data.durationMs === undefined
        ? {}
        : { videoDurationMs: node.data.durationMs }),
    }
  }

  const linkedVideo = findLinkedVideo(node.id, nodes, edges)

  return {
    ...base,
    ...(node.data.startTimeMs === undefined
      ? {}
      : { startTimeMs: node.data.startTimeMs }),
    ...(node.data.endTimeMs === undefined
      ? {}
      : { endTimeMs: node.data.endTimeMs }),
    ...(linkedVideo
      ? {
          linkedVideo: {
            id: linkedVideo.id,
            title: linkedVideo.data.title,
            provider: getVideoProvider(linkedVideo.data.source),
            source: linkedVideo.data.source,
            ...(linkedVideo.data.durationMs === undefined
              ? {}
              : { durationMs: linkedVideo.data.durationMs }),
          },
        }
      : {}),
  }
}
