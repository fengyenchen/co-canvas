import { z } from 'zod'

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  aiMode: z.enum(['mock', 'gemini']),
  geminiConfigured: z.boolean(),
})

export type { AiMode } from '../types/ai'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`)

  if (!response.ok) {
    throw new Error(`Health request failed: ${response.status}`)
  }

  return healthResponseSchema.parse(await response.json())
}
