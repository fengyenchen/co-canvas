import type { VideoCanvasNode } from '../types/canvas'
import type { VideoAnalysisRequest } from '../types/videoAnalysis'
import { getYouTubeVideoId } from '../components/video/youtube'

export const DEFAULT_VIDEO_ANALYSIS_PROMPT =
  '整理影片中的主要段落，為每個段落建立簡潔標題、摘要與時間區間。'

export function createVideoAnalysisRequest(
  node: VideoCanvasNode,
  prompt: string,
  maxSegments: number,
): VideoAnalysisRequest | null {
  if (!getYouTubeVideoId(node.data.source)) return null

  const normalizedPrompt = prompt.trim()
  if (!normalizedPrompt) return null

  return {
    videoNodeId: node.id,
    provider: 'youtube',
    source: node.data.source,
    title: node.data.title.trim() || '影片',
    prompt: normalizedPrompt,
    maxSegments: Math.min(8, Math.max(2, Math.round(maxSegments))),
  }
}
