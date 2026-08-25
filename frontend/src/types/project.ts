import type { CanvasEdge, CanvasNode } from './canvas'
import type { ChatMessage } from './chat'
import type { SuggestionDecisionEvent } from './suggestion'

export type ProjectDocument = {
  version: 4
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  messages: ChatMessage[]
  suggestionEvents: SuggestionDecisionEvent[]
}

export type ProjectVisibility = 'private' | 'public'
export type ProjectRole = 'owner' | 'editor' | 'viewer'
export type PublicAccessRole = Exclude<ProjectRole, 'owner'>
export type ProjectMemberRole = Exclude<ProjectRole, 'owner'>
export type ProjectVersionKind =
  | 'manual'
  | 'automatic'
  | 'pre_restore'
  | 'pre_import'

export type ProjectMember = {
  id: string
  email: string
  role: ProjectMemberRole
  createdAt: string
}

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

export type TrashedProjectSummary = ProjectSummary & {
  deletedAt: string
  expiresAt: string
}

export type ProjectVersionSummary = {
  id: string
  name: string | null
  kind: ProjectVersionKind
  createdAt: string
}

export type ProjectVersion = ProjectVersionSummary & {
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
  expectedUpdatedAt?: string
}
