export type LinkedVideoContext = {
  id: string
  title: string
  provider: string
  source: string
  durationMs?: number
}

export type LinkedFileContext = {
  id: string
  title: string
  nodeType: 'document' | 'image' | 'audio'
  fileName?: string
  mimeType?: string
  fileSize?: number
  fileSource?: string
  pageCount?: number
  pageUnit?: 'page' | 'slide'
  durationMs?: number
}

export type AiContextNode = {
  id: string
  title: string
  content: string
  nodeType: 'concept' | 'video' | 'audio' | 'document' | 'image' | 'group'
  fileName?: string
  mimeType?: string
  fileSize?: number
  fileSource?: string
  startTimeMs?: number
  endTimeMs?: number
  videoProvider?: string
  videoDurationMs?: number
  audioDurationMs?: number
  linkedVideo?: LinkedVideoContext
  linkedFile?: LinkedFileContext
  documentStartPage?: number
  documentEndPage?: number
  groupMembers?: AiContextNode[]
  groupRelations?: Array<{
    source: string
    target: string
    label?: string
  }>
}
