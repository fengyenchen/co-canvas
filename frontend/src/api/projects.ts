import { z } from 'zod'
import type {
  CreateProjectInput,
  Project,
  ProjectSummary,
  UpdateProjectInput,
} from '../types/project'
import { projectDocumentSchema } from '../utils/projectFile'
import { throwApiRequestError } from './errors'

const projectSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const projectSchema = projectSummarySchema.extend({
  document: projectDocumentSchema,
})

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/projects`)

  if (!response.ok) {
    return throwApiRequestError(response)
  }

  return z.array(projectSummarySchema).parse(await response.json())
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await fetch(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`,
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
    headers: {
      'Content-Type': 'application/json',
    },
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
      headers: {
        'Content-Type': 'application/json',
      },
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
    },
  )

  if (!response.ok) {
    return throwApiRequestError(response)
  }
}
