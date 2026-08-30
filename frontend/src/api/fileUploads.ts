import { z } from 'zod'
import { ApiRequestError, throwApiRequestError } from './errors'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const startSchema = z.object({ uploadUrl: z.string().url(), chunkSize: z.number().int().positive().max(8 * 1024 * 1024) })
const chunkSchema = z.object({ fileName: z.string().regex(/^files\/[A-Za-z0-9_-]+$/).nullable() })

export async function uploadLocalFileToGemini({ file, projectId, signal }: { file: File; projectId?: string; signal?: AbortSignal }) {
  if (file.size > 100 * 1024 * 1024) throw new ApiRequestError(413, '檔案超過 100 MB 分析限制')
  const startUrl = new URL(`${API_BASE_URL}/api/file-uploads/start`)
  const headers = new Headers({ 'Content-Type': 'application/json' })
  let token: string | null = null
  if (projectId && projectId !== 'local') {
    startUrl.searchParams.set('projectId', projectId)
    const { getAuthToken } = await import('../lib/auth')
    token = await getAuthToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const startResponse = await fetch(startUrl, { method: 'POST', headers, body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'text/plain', size: file.size }), signal })
  if (!startResponse.ok) return throwApiRequestError(startResponse)
  const { uploadUrl, chunkSize } = startSchema.parse(await startResponse.json())
  const chunkUrl = new URL(`${API_BASE_URL}/api/file-uploads/chunk`)
  if (projectId && projectId !== 'local') chunkUrl.searchParams.set('projectId', projectId)
  let resultName: string | null = null
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size)
    const final = end === file.size
    const chunkHeaders = new Headers({
      'Content-Type': 'application/octet-stream',
      'X-Co-Canvas-Upload-Url': uploadUrl,
      'X-Goog-Upload-Offset': String(offset),
      'X-Co-Canvas-Upload-Final': String(final),
    })
    if (token) chunkHeaders.set('Authorization', `Bearer ${token}`)
    const response = await fetch(chunkUrl, { method: 'POST', headers: chunkHeaders, body: file.slice(offset, end), signal })
    if (!response.ok) return throwApiRequestError(response)
    const parsed = chunkSchema.parse(await response.json())
    if (final) resultName = parsed.fileName
  }
  if (!resultName) throw new ApiRequestError(502, 'Gemini 未回傳檔案識別碼')
  return resultName
}
