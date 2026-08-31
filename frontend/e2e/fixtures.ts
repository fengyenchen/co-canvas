import type { Page, Route } from '@playwright/test'

const API_ORIGIN = 'http://127.0.0.1:4174'
const AUTH_ORIGIN = 'https://e2e-auth.local'

export const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
export const VERSION_ID = '22222222-2222-4222-8222-222222222222'
export const COPY_PROJECT_ID = '33333333-3333-4333-8333-333333333333'

const USER = {
  id: 'e2e-user',
  name: 'E2E 使用者',
  email: 'e2e@example.com',
  emailVerified: true,
  image: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export type E2eDocument = {
  version: 4
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
  messages: Array<Record<string, unknown>>
  suggestionEvents: Array<Record<string, unknown>>
}

export type E2eProject = {
  id: string
  name: string
  visibility: 'private' | 'public'
  publicAccessRole: 'editor' | 'viewer'
  accessRole: 'owner' | 'editor' | 'viewer'
  createdAt: string
  updatedAt: string
  lastViewedAt: string | null
  document: E2eDocument
}

export type E2eVersion = {
  id: string
  name: string | null
  kind: 'manual' | 'automatic' | 'pre_restore' | 'pre_import'
  createdAt: string
  document: E2eDocument
}

export type E2eTrashedProject = E2eProject & {
  deletedAt: string
  expiresAt: string
}

export type E2eState = {
  authenticated: boolean
  projects: E2eProject[]
  trashedProjects: E2eTrashedProject[]
  versions: Map<string, E2eVersion[]>
  projectUpdates: Array<Record<string, unknown>>
  researchEventSyncs: Array<{
    projectId: string
    events: Array<Record<string, unknown>>
  }>
  lastChatRequest: Record<string, unknown> | null
}

export function emptyDocument(): E2eDocument {
  return {
    version: 4,
    nodes: [],
    edges: [],
    messages: [],
    suggestionEvents: [],
  }
}

export function createProject(
  overrides: Partial<E2eProject> = {},
): E2eProject {
  return {
    id: PROJECT_ID,
    name: 'E2E 專案',
    visibility: 'private',
    publicAccessRole: 'viewer',
    accessRole: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastViewedAt: null,
    document: emptyDocument(),
    ...overrides,
  }
}

function projectSummary(project: E2eProject) {
  return {
    id: project.id,
    name: project.name,
    visibility: project.visibility,
    publicAccessRole: project.publicAccessRole,
    accessRole: project.accessRole,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lastViewedAt: project.lastViewedAt,
  }
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function installE2eMocks(
  page: Page,
  options: {
    authenticated?: boolean
    projects?: E2eProject[]
    versions?: Map<string, E2eVersion[]>
    trashedProjects?: E2eTrashedProject[]
    updateConflictCount?: number
    authAdmin?: boolean
    projectGetError?: {
      status: number
      detail: string
    }
  } = {},
): Promise<E2eState> {
  const state: E2eState = {
    authenticated: options.authenticated ?? true,
    projects: options.projects ? structuredClone(options.projects) : [],
    trashedProjects: options.trashedProjects
      ? structuredClone(options.trashedProjects)
      : [],
    versions: options.versions ?? new Map(),
    projectUpdates: [],
    researchEventSyncs: [],
    lastChatRequest: null,
  }
  let updateSequence = 0
  let remainingUpdateConflicts = options.updateConflictCount ?? 0

  await page.route(`${AUTH_ORIGIN}/**`, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/sign-in/email') && request.method() === 'POST') {
      const body = request.postDataJSON() as { email?: string }
      if (body.email === 'unverified@example.com') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Email not verified',
          }),
        })
        return
      }
      state.authenticated = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'set-auth-jwt': 'e2e-jwt' },
        body: JSON.stringify({
          redirect: false,
          token: 'e2e-session-token',
          user: USER,
        }),
      })
      return
    }

    if (pathname.endsWith('/sign-up/email') && request.method() === 'POST') {
      state.authenticated = false
      await json(route, {
        token: null,
        user: { ...USER, emailVerified: false },
      })
      return
    }

    if (
      pathname.endsWith('/send-verification-email') &&
      request.method() === 'POST'
    ) {
      await json(route, { status: true })
      return
    }

    if (pathname.endsWith('/sign-out')) {
      state.authenticated = false
      await json(route, { success: true })
      return
    }

    if (pathname.endsWith('/get-session')) {
      await json(
        route,
        state.authenticated
          ? {
              session: {
                id: 'e2e-session',
                userId: USER.id,
                token: 'e2e-jwt',
                expiresAt: '2099-01-01T00:00:00.000Z',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              user: USER,
            }
          : null,
      )
      return
    }

    await json(route, {})
  })

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (path === '/health') {
      await json(route, {
        status: 'ok',
        service: 'co-canvas-api',
        aiMode: 'mock',
        geminiConfigured: false,
        databaseConfigured: true,
        authConfigured: true,
      })
      return
    }

    if (path === '/api/auth/welcome' && method === 'POST') {
      await json(route, { status: 'already_sent' })
      return
    }

    if (path === '/api/admin/auth/access' && method === 'GET') {
      await json(
        route,
        options.authAdmin === false ? { detail: '沒有帳號管理權限' } : { allowed: true },
        options.authAdmin === false ? 403 : 200,
      )
      return
    }

    if (path === '/api/admin/auth/accounts' && method === 'GET') {
      await json(route, {
        counts: { verified: 1, waiting: 1, permanentBounce: 1 },
        accounts: [
          {
            email: 'verified@example.com',
            status: 'verified',
            createdAt: '2026-08-30T01:00:00.000Z',
          },
          {
            email: 'waiting@example.com',
            status: 'waiting',
            createdAt: '2026-08-31T01:00:00.000Z',
          },
        ],
        cleanupEvents: [
          {
            emailHash: 'a'.repeat(64),
            reason: 'permanent_bounce',
            deletedAt: '2026-08-31T02:00:00.000Z',
          },
        ],
      })
      return
    }

    if (path === '/api/me/ai-credentials/gemini') {
      await json(route, {
        provider: 'gemini',
        configured: true,
        keyHint: '…e2e',
        status: 'valid',
        lastValidatedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        validationResult: 'valid',
      })
      return
    }

    if (path === '/api/chat' && method === 'POST') {
      state.lastChatRequest = request.postDataJSON() as Record<string, unknown>
      await json(route, {
        message: '**影片分析完成**\n\n- 已收到指定片段',
        aiMode: 'gemini',
        fallbackReason: null,
      })
      return
    }

    if (path === '/api/projects' && method === 'GET') {
      await json(route, state.projects.map(projectSummary))
      return
    }

    if (path === '/api/projects' && method === 'POST') {
      const input = request.postDataJSON() as {
        name: string
        document?: E2eDocument
        visibility?: 'private' | 'public'
        publicAccessRole?: 'editor' | 'viewer'
      }
      const project = createProject({
        id: state.projects.length === 0 ? PROJECT_ID : COPY_PROJECT_ID,
        name: input.name,
        document: input.document ?? emptyDocument(),
        visibility: input.visibility ?? 'private',
        publicAccessRole: input.publicAccessRole ?? 'viewer',
      })
      state.projects.push(project)
      await json(route, project, 201)
      return
    }

    if (path === '/api/projects/trash' && method === 'GET') {
      await json(
        route,
        state.trashedProjects.map((project) => ({
          ...projectSummary(project),
          deletedAt: project.deletedAt,
          expiresAt: project.expiresAt,
        })),
      )
      return
    }

    const restoreProjectMatch = path.match(/^\/api\/projects\/([^/]+)\/restore$/)
    if (restoreProjectMatch && method === 'POST') {
      const projectIndex = state.trashedProjects.findIndex(
        (item) => item.id === restoreProjectMatch[1],
      )
      const trashedProject = state.trashedProjects[projectIndex]

      if (!trashedProject) {
        await json(route, { detail: '找不到垃圾桶專案' }, 404)
        return
      }

      const project: E2eProject = {
        id: trashedProject.id,
        name: trashedProject.name,
        visibility: trashedProject.visibility,
        publicAccessRole: trashedProject.publicAccessRole,
        accessRole: trashedProject.accessRole,
        createdAt: trashedProject.createdAt,
        updatedAt: trashedProject.updatedAt,
        lastViewedAt: trashedProject.lastViewedAt,
        document: trashedProject.document,
      }
      state.trashedProjects.splice(projectIndex, 1)
      state.projects.unshift(project)
      await json(route, project)
      return
    }

    const permanentDeleteMatch = path.match(
      /^\/api\/projects\/([^/]+)\/permanent$/,
    )
    if (permanentDeleteMatch && method === 'DELETE') {
      state.trashedProjects = state.trashedProjects.filter(
        (item) => item.id !== permanentDeleteMatch[1],
      )
      await route.fulfill({ status: 204 })
      return
    }

    const restoreVersionMatch = path.match(
      /^\/api\/projects\/([^/]+)\/versions\/([^/]+)\/restore$/,
    )
    if (restoreVersionMatch && method === 'POST') {
      const [, projectId, versionId] = restoreVersionMatch
      const project = state.projects.find((item) => item.id === projectId)
      const version = state.versions
        .get(projectId)
        ?.find((item) => item.id === versionId)

      if (!project || !version) {
        await json(route, { detail: '找不到版本' }, 404)
        return
      }

      project.document = structuredClone(version.document)
      project.updatedAt = `2026-01-01T00:00:${String(++updateSequence).padStart(2, '0')}.000Z`
      await json(route, project)
      return
    }

    const versionDetailMatch = path.match(
      /^\/api\/projects\/([^/]+)\/versions\/([^/]+)$/,
    )
    if (versionDetailMatch && method === 'GET') {
      const [, projectId, versionId] = versionDetailMatch
      const version = state.versions
        .get(projectId)
        ?.find((item) => item.id === versionId)
      await json(route, version ?? { detail: '找不到版本' }, version ? 200 : 404)
      return
    }

    const versionsMatch = path.match(/^\/api\/projects\/([^/]+)\/versions$/)
    if (versionsMatch) {
      const projectId = versionsMatch[1]
      const versions = state.versions.get(projectId) ?? []

      if (method === 'GET') {
        await json(
          route,
          versions.map((version) => ({
            id: version.id,
            name: version.name,
            kind: version.kind,
            createdAt: version.createdAt,
          })),
        )
        return
      }

      if (method === 'POST') {
        const project = state.projects.find((item) => item.id === projectId)
        const input = request.postDataJSON() as {
          name: string | null
          kind: E2eVersion['kind']
        }
        const version: E2eVersion = {
          id: VERSION_ID,
          name: input.name,
          kind: input.kind,
          createdAt: '2026-01-01T00:01:00.000Z',
          document: structuredClone(project?.document ?? emptyDocument()),
        }
        versions.unshift(version)
        state.versions.set(projectId, versions)
        await json(route, version, 201)
        return
      }
    }

    const researchEventsMatch = path.match(
      /^\/api\/projects\/([^/]+)\/research-events$/,
    )
    if (researchEventsMatch && method === 'POST') {
      const input = request.postDataJSON() as {
        events: Array<Record<string, unknown>>
      }
      state.researchEventSyncs.push({
        projectId: researchEventsMatch[1],
        events: input.events,
      })
      await route.fulfill({ status: 204 })
      return
    }

    const projectViewMatch = path.match(
      /^\/api\/projects\/([^/]+)\/view$/,
    )
    if (projectViewMatch && method === 'POST') {
      const project = state.projects.find(
        (item) => item.id === projectViewMatch[1],
      )
      if (!project) {
        await json(route, { detail: '找不到專案' }, 404)
        return
      }
      project.lastViewedAt = '2026-01-04T00:00:00.000Z'
      await route.fulfill({ status: 204 })
      return
    }

    const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/)
    if (projectMatch) {
      if (method === 'GET' && options.projectGetError) {
        await json(
          route,
          { detail: options.projectGetError.detail },
          options.projectGetError.status,
        )
        return
      }

      const project = state.projects.find((item) => item.id === projectMatch[1])

      if (!project) {
        await json(route, { detail: '找不到專案' }, 404)
        return
      }

      if (method === 'GET') {
        await json(route, project)
        return
      }

      if (method === 'PATCH') {
        if (remainingUpdateConflicts > 0) {
          remainingUpdateConflicts -= 1
          await json(
            route,
            { detail: '專案已由其他工作階段更新' },
            409,
          )
          return
        }

        const input = request.postDataJSON() as Record<string, unknown>
        state.projectUpdates.push(input)
        if (typeof input.name === 'string') project.name = input.name
        if (input.document) project.document = input.document as E2eDocument
        if (input.visibility === 'private' || input.visibility === 'public') {
          project.visibility = input.visibility
        }
        if (input.publicAccessRole === 'editor' || input.publicAccessRole === 'viewer') {
          project.publicAccessRole = input.publicAccessRole
        }
        project.updatedAt = `2026-01-01T00:00:${String(++updateSequence).padStart(2, '0')}.000Z`
        await json(route, project)
        return
      }


      if (method === 'DELETE') {
        state.projects = state.projects.filter((item) => item.id !== project.id)
        state.trashedProjects.unshift({
          ...project,
          deletedAt: '2026-01-02T00:00:00.000Z',
          expiresAt: '2099-01-01T00:00:00.000Z',
        })
        await route.fulfill({ status: 204 })
        return
      }
    }

    await json(route, { detail: `未模擬 ${method} ${path}` }, 404)
  })

  return state
}
