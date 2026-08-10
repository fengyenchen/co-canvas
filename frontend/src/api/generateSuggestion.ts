import { z } from 'zod'
import type { AiSuggestion } from '../types/suggestion'

type ContextNode = {
  id: string
  title: string
  content: string
}

type GenerateSuggestionInput = {
  prompt: string
  selectedNode: ContextNode
  neighborNodes: ContextNode[]
}

const suggestionSchema = z.object({
  nodes: z.array(z.object({
    tempId: z.string(),
    title: z.string(),
    content: z.string(),
  })),
  relations: z.array(z.object({
    sourceTempId: z.string(),
    targetTempId: z.string(),
    label: z.string().optional(),
  })),
})

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function generateSuggestion(
  input: GenerateSuggestionInput,
): Promise<AiSuggestion> {
  const response = await fetch(
    `${API_BASE_URL}/api/suggestions/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return suggestionSchema.parse(await response.json())
}
