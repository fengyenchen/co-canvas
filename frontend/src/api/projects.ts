import { z } from 'zod'
import type {
  CreateProjectInput,
  Project,
  ProjectMember,
  ProjectMemberRole,
  ProjectSummary,
  ProjectVersion,
  ProjectVersionKind,
  ProjectVersionSummary,
  TrashedProjectSummary,
  UpdateProjectInput,
} from '../types/project'
import { projectDocumentSchema } from '../utils/projectFile'
import { ApiRequestError, throwApiRequestError } from './errors'

const projectSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  visibility: z.enum(['private', 'public']),
  publicAccessRole: z.enum(['editor', 'viewer']),
  accessRole: z.enum(['owner', 'editor', 'viewer']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const projectSchema = projectSummarySchema.extend({
  document: projectDocumentSchema,
})

const trashedProjectSummarySchema = projectSummarySchema.extend({
  deletedAt: z.string(),
  expiresAt: z.string(),
})

const projectMemberSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(['editor', 'viewer']),
  createdAt: z.string(),
})

const projectVersionSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  kind: z.enum(['manual', 'automatic', 'pre_restore', 'pre_import']),
  createdAt: z.string(),
})

const projectVersionSchema = projectVersionSummarySchema.extend({
  document: projectDocumentSchema,
})

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function createRequestHeaders(
  includeJsonContentType = false,
): Promise<HeadersInit> {
  let token: string | null

  try {
    const { getAuthToken } = await import('../lib/auth')
    token = await getAuthToken()
  } catch {
    throw new ApiRequestError(
      401,
      '登入狀態已失效，請登出後重新登入',
    )
  }

  const headers = new Headers()

  if (includeJsonContentType) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    headers: await createRequestHeaders(),
  })

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return z.array(projectSummarySchema).parse(await response.json())
}

export async function listTrashedProjects(): Promise<TrashedProjectSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/projects/trash`, {
    headers: await createRequestHeaders(),
  })

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return z.array(trashedProjectSummarySchema).parse(await response.json())
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`,
    {
      headers: await createRequestHeaders(),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectSchema.parse(await response.json())
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: await createRequestHeaders(true),
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectSchema.parse(await response.json())
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: await createRequestHeaders(true),
      body: JSON.stringify(input),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectSchema.parse(await response.json())
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'DELETE',
      headers: await createRequestHeaders(),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }
}

export async function restoreProject(projectId: string): Promise<Project> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/restore`,
    {
      method: 'POST',
      headers: await createRequestHeaders(),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectSchema.parse(await response.json())
}

export async function permanentlyDeleteProject(projectId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/permanent`,
    {
      method: 'DELETE',
      headers: await createRequestHeaders(),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }
}

export async function listProjectVersions(
  projectId: string,
): Promise<ProjectVersionSummary[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/versions`,
    { headers: await createRequestHeaders() },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return z.array(projectVersionSummarySchema).parse(await response.json())
}

export async function createProjectVersion(
  projectId: string,
  name?: string,
  kind: Exclude<ProjectVersionKind, 'pre_restore'> = 'manual',
): Promise<ProjectVersion> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/versions`,
    {
      method: 'POST',
      headers: await createRequestHeaders(true),
      body: JSON.stringify({ name: name?.trim() || null, kind }),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectVersionSchema.parse(await response.json())
}

export async function getProjectVersion(
  projectId: string,
  versionId: string,
): Promise<ProjectVersion> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    { headers: await createRequestHeaders() },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectVersionSchema.parse(await response.json())
}

export async function restoreProjectVersion(
  projectId: string,
  versionId: string,
  expectedUpdatedAt?: string,
): Promise<Project> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/restore`,
    {
      method: 'POST',
      headers: await createRequestHeaders(true),
      body: JSON.stringify({ expectedUpdatedAt }),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectSchema.parse(await response.json())
}

export async function listProjectMembers(
  projectId: string,
): Promise<ProjectMember[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members`,
    { headers: await createRequestHeaders() },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return z.array(projectMemberSchema).parse(await response.json())
}

export async function addProjectMember(
  projectId: string,
  email: string,
  role: ProjectMemberRole,
): Promise<ProjectMember> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members`,
    {
      method: 'POST',
      headers: await createRequestHeaders(true),
      body: JSON.stringify({ email, role }),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectMemberSchema.parse(await response.json())
}

export async function updateProjectMember(
  projectId: string,
  memberId: string,
  role: ProjectMemberRole,
): Promise<ProjectMember> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'PATCH',
      headers: await createRequestHeaders(true),
      body: JSON.stringify({ role }),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return projectMemberSchema.parse(await response.json())
}

export async function removeProjectMember(
  projectId: string,
  memberId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'DELETE',
      headers: await createRequestHeaders(),
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }
}

export async function downloadProjectResearchEvents(
  projectId: string,
  projectName: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/research-events/export?format=csv`,
    { headers: await createRequestHeaders() },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${projectName}-research-events.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
