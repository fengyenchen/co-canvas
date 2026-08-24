import type { AiMode } from './ai'

export type SuggestedNode = {
  tempId: string
  title: string
  content: string
}

export type SuggestedRelation = {
  sourceTempId: string
  targetTempId: string
  label?: string
}

export type AiSuggestion = {
  nodes: SuggestedNode[]
  relations: SuggestedRelation[]
}

export type SuggestionPreview = {
  contextNodeId: string | null
  prompt: string
  suggestion: AiSuggestion
  latencyMs: number
  aiMode: AiMode
  previewedAt: string
  edited: boolean
}

export type SuggestionDecision = 'accepted' | 'rejected' | 'regenerated'

export type SuggestionDecisionEvent = {
  id: string
  action: SuggestionDecision
  contextNodeId: string | null
  aiMode: AiMode
  edited: boolean
  decisionTimeMs: number
  nodeCount: number
  createdAt: string
}
