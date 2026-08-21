import { z } from 'zod'
import type { AiSuggestion } from '../types/suggestion'
import { throwApiRequestError } from './errors'

type ContextNode = {
  id: string
  title: string
  content: string
}

type GenerateSuggestionInput = {
  prompt: string
  selectedNode: ContextNode
  neighborNodes: ContextNode[]
  projectId?: string
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
  const { projectId, ...requestBody } = input
  const requestUrl = new URL(
    `${API_BASE_URL}/api/suggestions/generate`,
  )
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (projectId && projectId !== 'local') {
    requestUrl.searchParams.set('projectId', projectId)
    const { getAuthToken } = await import('../lib/auth')
    const token = await getAuthToken()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(
    requestUrl,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return suggestionSchema.parse(await response.json())
}
