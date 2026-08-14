import type { CanvasEdge, CanvasNode } from './canvas'
import type { ChatMessage } from './chat'

export type ProjectDocument = {
  version: 1
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  messages: ChatMessage[]
}

export type ProjectVisibility = 'private' | 'public'

export type ProjectSummary = {
  id: string
  name: string
  visibility: ProjectVisibility
  createdAt: string
  updatedAt: string
}

export type Project = ProjectSummary & {
  document: ProjectDocument
}

export type CreateProjectInput = {
  name: string
  document?: ProjectDocument
  visibility?: ProjectVisibility
}

export type UpdateProjectInput = {
  name?: string
  document?: ProjectDocument
  visibility?: ProjectVisibility
}
