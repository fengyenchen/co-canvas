import { createInternalNeonAuth } from '@neondatabase/neon-js/auth'

const neonAuthUrl = import.meta.env.VITE_NEON_AUTH_URL

if (!neonAuthUrl) {
  throw new Error('缺少 VITE_NEON_AUTH_URL 環境變數')
}

const neonAuth = createInternalNeonAuth(neonAuthUrl)

export const authClient = neonAuth.adapter
export const getAuthToken = neonAuth.getJWTToken
