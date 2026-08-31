import { z } from 'zod'
import { getAuthToken } from '../lib/auth'
import { throwApiRequestError } from './errors'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const accountStatusSchema = z.object({
  email: z.email(),
  status: z.enum(['verified', 'waiting']),
  createdAt: z.string(),
})

const cleanupEventSchema = z.object({
  emailHash: z.string().length(64),
  reason: z.enum(['permanent_bounce', 'expired_unverified']),
  deletedAt: z.string(),
})

const authAccountOverviewSchema = z.object({
  counts: z.object({
    verified: z.number().int().nonnegative(),
    waiting: z.number().int().nonnegative(),
    permanentBounce: z.number().int().nonnegative(),
  }),
  accounts: z.array(accountStatusSchema),
  cleanupEvents: z.array(cleanupEventSchema),
})

export type AuthAccountOverview = z.infer<typeof authAccountOverviewSchema>

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function canManageAuthAccounts(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/access`, {
    headers: await authHeaders(),
  })
  if (response.status === 401 || response.status === 403) return false
  if (!response.ok) return throwApiRequestError(response)
  return z.object({ allowed: z.literal(true) }).parse(await response.json())
    .allowed
}

export async function getAuthAccountOverview(): Promise<AuthAccountOverview> {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/accounts`, {
    headers: await authHeaders(),
  })
  if (!response.ok) return throwApiRequestError(response)
  return authAccountOverviewSchema.parse(await response.json())
}

export async function ensureWelcomeEmail(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/welcome`, {
    method: 'POST',
    headers: await authHeaders(),
  })
  if (!response.ok) return throwApiRequestError(response)
}
