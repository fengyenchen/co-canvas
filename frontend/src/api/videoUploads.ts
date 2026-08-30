import { z } from 'zod'
import { ApiRequestError, throwApiRequestError } from './errors'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const uploadStartResponseSchema = z.object({
  uploadUrl: z.string().url(),
  chunkSize: z.number().int().positive().max(8 * 1024 * 1024),
})

const uploadChunkResponseSchema = z.object({
  fileName: z.string().regex(/^files\/[A-Za-z0-9_-]+$/).nullable(),
})

function getVideoMimeType(file: File): 'video/mp4' | 'video/mov' | 'video/webm' {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'mov') return 'video/mov'
  if (extension === 'webm') return 'video/webm'
  return 'video/mp4'
}

export async function uploadLocalVideoToGemini({
  file,
  projectId,
  signal,
}: {
  file: File
  projectId?: string
  signal?: AbortSignal
}): Promise<string> {
  if (file.size > 450 * 1024 * 1024) {
    throw new ApiRequestError(413, '影片檔案超過 450 MB 分析限制')
  }

  const mimeType = getVideoMimeType(file)
  const requestUrl = new URL(`${API_BASE_URL}/api/video-uploads/start`)
  const headers = new Headers({ 'Content-Type': 'application/json' })
  let authToken: string | null = null

  if (projectId && projectId !== 'local') {
    requestUrl.searchParams.set('projectId', projectId)
    const { getAuthToken } = await import('../lib/auth')
    authToken = await getAuthToken()
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`)
  }

  const startResponse = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      size: file.size,
    }),
    signal,
  })
  if (!startResponse.ok) return throwApiRequestError(startResponse)

  const { uploadUrl, chunkSize } = uploadStartResponseSchema.parse(
    await startResponse.json(),
  )

  const chunkUrl = new URL(`${API_BASE_URL}/api/video-uploads/chunk`)
  if (projectId && projectId !== 'local') {
    chunkUrl.searchParams.set('projectId', projectId)
  }

  let uploadedFileName: string | null = null
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size)
    const isFinal = end === file.size
    const chunkHeaders = new Headers({
      'Content-Type': 'application/octet-stream',
      'X-Co-Canvas-Upload-Url': uploadUrl,
      'X-Goog-Upload-Offset': String(offset),
      'X-Co-Canvas-Upload-Final': String(isFinal),
    })
    if (authToken) {
      chunkHeaders.set('Authorization', `Bearer ${authToken}`)
    }

    const chunkResponse = await fetch(chunkUrl, {
      method: 'POST',
      headers: chunkHeaders,
      body: file.slice(offset, end),
      signal,
    })
    if (!chunkResponse.ok) return throwApiRequestError(chunkResponse)

    const result = uploadChunkResponseSchema.parse(
      await chunkResponse.json(),
    )
    if (isFinal) uploadedFileName = result.fileName
  }

  if (!uploadedFileName) {
    throw new ApiRequestError(502, 'Gemini 未回傳影片檔案識別碼')
  }
  return uploadedFileName
}
