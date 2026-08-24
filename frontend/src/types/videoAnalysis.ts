export type VideoAnalysisProvider = 'youtube'

export type VideoAnalysisRequest = {
  videoNodeId: string
  provider: VideoAnalysisProvider
  source: string
  title: string
  prompt: string
  maxSegments: number
}
