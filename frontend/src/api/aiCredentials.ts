import { z } from 'zod'
import { throwApiRequestError } from './errors'

const aiCredentialSchema = z.object({
  provider: z.literal('gemini'),
  configured: z.boolean(),
  keyHint: z.string().nullable(),
  status: z.enum(['unverified', 'valid', 'invalid']).nullable(),
  lastValidatedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export type AiCredential = z.infer<typeof aiCredentialSchema>

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function createRequestHeaders(
  includeJsonContentType = false,
): Promise<HeadersInit> {
  const { getAuthToken } = await import('../lib/auth')
  const token = await getAuthToken()
  const headers = new Headers()

  if (includeJsonContentType) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

export async function getGeminiCredential(): Promise<AiCredential> {
  const response = await fetch(
    `${API_BASE_URL}/api/me/ai-credentials/gemini`,
    { headers: await createRequestHeaders() },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return aiCredentialSchema.parse(await response.json())
}

export async function saveGeminiCredential(
  apiKey: string,
): Promise<AiCredential> {
  const response = await fetch(
    `${API_BASE_URL}/api/me/ai-credentials/gemini`,
    {
      method: 'PUT',
      headers: await createRequestHeaders(true),
      body: JSON.stringify({ apiKey }),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return aiCredentialSchema.parse(await response.json())
}

export async function deleteGeminiCredential(): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/me/ai-credentials/gemini`,
    {
      method: 'DELETE',
      headers: await createRequestHeaders(),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }
}
