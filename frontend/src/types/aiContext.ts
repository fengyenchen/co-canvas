export type LinkedVideoContext = {
  id: string
  title: string
  provider: string
  source: string
  durationMs?: number
}

export type AiContextNode = {
  id: string
  title: string
  content: string
  nodeType: 'concept' | 'video' | 'group'
  startTimeMs?: number
  endTimeMs?: number
  videoProvider?: string
  videoDurationMs?: number
  linkedVideo?: LinkedVideoContext
  groupMembers?: AiContextNode[]
  groupRelations?: Array<{
    source: string
    target: string
    label?: string
  }>
}
