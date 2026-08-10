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
}
