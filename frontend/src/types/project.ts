import type { CanvasEdge, CanvasNode } from './canvas'
import type { ChatMessage } from './chat'

export type ProjectDocument = {
  version: 1
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  messages: ChatMessage[]
}

export type ProjectVisibility = 'private' | 'public'
export type ProjectRole = 'owner' | 'editor' | 'viewer'
export type PublicAccessRole = Exclude<ProjectRole, 'owner'>

export type ProjectSummary = {
  id: string
  name: string
  visibility: ProjectVisibility
  publicAccessRole: PublicAccessRole
  accessRole: ProjectRole
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
  publicAccessRole?: PublicAccessRole
}

export type UpdateProjectInput = {
  name?: string
  document?: ProjectDocument
  visibility?: ProjectVisibility
  publicAccessRole?: PublicAccessRole
}
