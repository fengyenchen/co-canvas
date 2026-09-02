import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Search, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import {
  addProjectMember,
  createProject,
  deleteProject,
  getProject,
  listProjectMembers,
  listProjects,
  removeProjectMember,
  removeProjectFromList,
  updateProject,
  updateProjectMember,
} from '../api/projects'
import { ApiRequestError } from '../api/errors'
import { ensureWelcomeEmail } from '../api/authAdmin'
import { ProjectTrash } from '../components/project/ProjectTrash'
import {
  deleteGeminiCredential,
  getGeminiCredential,
  saveGeminiCredential,
  type AiCredential,
} from '../api/aiCredentials'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'
import type {
  ProjectSummary,
  ProjectMember,
  ProjectMemberRole,
  ProjectRole,
  ProjectVisibility,
  PublicAccessRole,
} from '../types/project'
import { getLocalProjectDocument } from '../utils/localProjectBackup'

type CreateProjectMode = 'empty' | 'local'
type ProjectSort =
  | 'viewed-desc'
  | 'updated-desc'
  | 'updated-asc'
  | 'name-asc'
const PROJECT_COPY_SUFFIX = '（副本）'

function getProjectCopyName(name: string) {
  return `${name.slice(0, 120 - PROJECT_COPY_SUFFIX.length)}${PROJECT_COPY_SUFFIX}`
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '更新時間不明'
  }

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getProjectRoleLabel(role: ProjectRole) {
  const labels: Record<ProjectRole, string> = {
    owner: '擁有者',
    editor: '編輯者',
    viewer: '檢視者',
  }

  return labels[role]
}

function getLoadErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.detail
  }

  if (error instanceof TypeError) {
    return '無法連線後端，請確認服務已啟動。'
  }

  return '專案資料格式無效，請稍後再試。'
}

export function HomePage() {
  const navigate = useNavigate()
  const createDialogRef = useRef<HTMLDialogElement>(null)
  const renameDialogRef = useRef<HTMLDialogElement>(null)
  const permissionDialogRef = useRef<HTMLDialogElement>(null)
  const aiSettingsDialogRef = useRef<HTMLDialogElement>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [projectName, setProjectName] = useState('')
  const [createProjectMode, setCreateProjectMode] =
    useState<CreateProjectMode>('empty')
  const [isCreating, setIsCreating] = useState(false)
  const [createErrorMessage, setCreateErrorMessage] = useState<
    string | null
  >(null)
  const [renamingProject, setRenamingProject] =
    useState<ProjectSummary | null>(null)
  const [renamedProjectName, setRenamedProjectName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameErrorMessage, setRenameErrorMessage] = useState<
    string | null
  >(null)
  const [permissionProject, setPermissionProject] =
    useState<ProjectSummary | null>(null)
  const [projectVisibility, setProjectVisibility] =
    useState<ProjectVisibility>('private')
  const [publicAccessRole, setPublicAccessRole] =
    useState<PublicAccessRole>('viewer')
  const [isSavingPermission, setIsSavingPermission] = useState(false)
  const [permissionErrorMessage, setPermissionErrorMessage] = useState<
    string | null
  >(null)
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [hasLoadedMembers, setHasLoadedMembers] = useState(false)
  const [memberEmail, setMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] =
    useState<ProjectMemberRole>('viewer')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(
    null,
  )
  const [memberErrorMessage, setMemberErrorMessage] = useState<
    string | null
  >(null)
  const [deletingProjectId, setDeletingProjectId] = useState<
    string | null
  >(null)
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<
    string | null
  >(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<
    string | null
  >(null)
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(
    null,
  )
  const [openProjectMenuId, setOpenProjectMenuId] = useState<
    string | null
  >(null)
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectSort, setProjectSort] =
    useState<ProjectSort>('viewed-desc')
  const [aiCredential, setAiCredential] = useState<AiCredential | null>(
    null,
  )
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [isLoadingAiSettings, setIsLoadingAiSettings] = useState(false)
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false)
  const [isRemovingAiCredential, setIsRemovingAiCredential] =
    useState(false)
  const [aiSettingsError, setAiSettingsError] = useState<string | null>(
    null,
  )
  const visibleProjects = useMemo(() => {
    const normalizedSearch = projectSearch.trim().toLocaleLowerCase('zh-TW')
    const filteredProjects = normalizedSearch
      ? projects.filter((project) =>
          project.name.toLocaleLowerCase('zh-TW').includes(normalizedSearch),
        )
      : [...projects]

    return filteredProjects.sort((firstProject, secondProject) => {
      if (projectSort === 'name-asc') {
        return firstProject.name.localeCompare(secondProject.name, 'zh-TW', {
          numeric: true,
          sensitivity: 'base',
        })
      }

      if (projectSort === 'viewed-desc') {
        const firstViewedAt = firstProject.lastViewedAt
          ? Date.parse(firstProject.lastViewedAt)
          : Number.NEGATIVE_INFINITY
        const secondViewedAt = secondProject.lastViewedAt
          ? Date.parse(secondProject.lastViewedAt)
          : Number.NEGATIVE_INFINITY
        const viewTimeDifference = secondViewedAt - firstViewedAt

        if (viewTimeDifference !== 0) {
          return viewTimeDifference
        }

        return (
          Date.parse(secondProject.updatedAt) -
          Date.parse(firstProject.updatedAt)
        )
      }

      const timeDifference =
        Date.parse(firstProject.updatedAt) - Date.parse(secondProject.updatedAt)

      return projectSort === 'updated-asc' ? timeDifference : -timeDifference
    })
  }, [projectSearch, projectSort, projects])

  useEffect(() => {
    let isCancelled = false

    async function loadSession() {
      try {
        const { authClient } = await import('../lib/auth')
        const { data } = await authClient.getSession()

        if (!isCancelled) {
          setAuthUserEmail(data?.user.email ?? null)
        }
      } catch {
        if (!isCancelled) {
          setAuthUserEmail(null)
        }
      } finally {
        if (!isCancelled) {
          setIsAuthLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!authUserEmail) {
      return
    }

    void ensureWelcomeEmail().catch(() => undefined)
  }, [authUserEmail])

  useEffect(() => {
    if (isAuthLoading || !authUserEmail) {
      return
    }

    let isCancelled = false

    async function loadProjects() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const result = await listProjects()

        if (!isCancelled) {
          setProjects(result)
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(getLoadErrorMessage(error))
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      isCancelled = true
    }
  }, [authUserEmail, isAuthLoading, loadAttempt])

  async function handleCreateProject() {
    const name = projectName.trim()

    if (!authUserEmail || !name || isCreating) {
      return
    }

    setIsCreating(true)
    setCreateErrorMessage(null)

    try {
      const localDocument =
        createProjectMode === 'local'
          ? getLocalProjectDocument()
          : null

      if (
        createProjectMode === 'local' &&
        (!localDocument ||
          (localDocument.nodes.length === 0 &&
            localDocument.edges.length === 0 &&
            localDocument.messages.length === 0))
      ) {
        setCreateErrorMessage('本機畫布目前沒有內容可儲存。')
        return
      }

      const project = await createProject({
        name,
        ...(localDocument ? { document: localDocument } : {}),
      })
      setProjects((currentProjects) => [project, ...currentProjects])
      createDialogRef.current?.close()
      void navigate(`/projects/${project.id}`)
    } catch (error) {
      setCreateErrorMessage(getLoadErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  function openCreateProjectDialog(mode: CreateProjectMode) {
    setCreateProjectMode(mode)
    setProjectName(mode === 'local' ? '本機畫布' : '')
    setCreateErrorMessage(null)
    createDialogRef.current?.showModal()
  }

  function openRenameDialog(project: ProjectSummary) {
    setRenamingProject(project)
    setRenamedProjectName(project.name)
    setRenameErrorMessage(null)
    renameDialogRef.current?.showModal()
  }

  async function handleRenameProject() {
    const name = renamedProjectName.trim()

    if (!renamingProject || !name || isRenaming) {
      return
    }

    setIsRenaming(true)
    setRenameErrorMessage(null)

    try {
      const updatedProject = await updateProject(
        renamingProject.id,
        { name },
      )
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === updatedProject.id
            ? {
                ...updatedProject,
                lastViewedAt: project.lastViewedAt,
              }
            : project,
        ),
      )
      renameDialogRef.current?.close()
    } catch (error) {
      setRenameErrorMessage(getLoadErrorMessage(error))
    } finally {
      setIsRenaming(false)
    }
  }

  function openPermissionDialog(project: ProjectSummary) {
    setPermissionProject(project)
    setProjectVisibility(project.visibility)
    setPublicAccessRole(project.publicAccessRole)
    setPermissionErrorMessage(null)
    setProjectMembers([])
    setHasLoadedMembers(false)
    setMemberEmail('')
    setNewMemberRole('viewer')
    setMemberErrorMessage(null)
    permissionDialogRef.current?.showModal()
    if (project.visibility === 'private') {
      void loadProjectMembers(project.id)
    }
  }

  async function loadProjectMembers(projectId: string) {
    setIsLoadingMembers(true)
    setMemberErrorMessage(null)

    try {
      setProjectMembers(await listProjectMembers(projectId))
      setHasLoadedMembers(true)
    } catch (error) {
      setMemberErrorMessage(getLoadErrorMessage(error))
    } finally {
      setIsLoadingMembers(false)
    }
  }

  async function handleAddMember() {
    const email = memberEmail.trim().toLowerCase()

    if (!permissionProject || !email || isAddingMember) {
      return
    }

    setIsAddingMember(true)
    setMemberErrorMessage(null)

    try {
      const member = await addProjectMember(
        permissionProject.id,
        email,
        newMemberRole,
      )
      setProjectMembers((members) => [...members, member])
      setMemberEmail('')
      setNewMemberRole('viewer')
    } catch (error) {
      setMemberErrorMessage(getLoadErrorMessage(error))
    } finally {
      setIsAddingMember(false)
    }
  }

  async function handleUpdateMemberRole(
    member: ProjectMember,
    role: ProjectMemberRole,
  ) {
    if (!permissionProject || updatingMemberId) {
      return
    }

    setUpdatingMemberId(member.id)
    setMemberErrorMessage(null)

    try {
      const updatedMember = await updateProjectMember(
        permissionProject.id,
        member.id,
        role,
      )
      setProjectMembers((members) =>
        members.map((currentMember) =>
          currentMember.id === updatedMember.id
            ? updatedMember
            : currentMember,
        ),
      )
    } catch (error) {
      setMemberErrorMessage(getLoadErrorMessage(error))
    } finally {
      setUpdatingMemberId(null)
    }
  }

  async function handleRemoveMember(member: ProjectMember) {
    if (
      !permissionProject ||
      updatingMemberId ||
      !window.confirm(`確定要移除 ${member.email} 嗎？`)
    ) {
      return
    }

    setUpdatingMemberId(member.id)
    setMemberErrorMessage(null)

    try {
      await removeProjectMember(permissionProject.id, member.id)
      setProjectMembers((members) =>
        members.filter((currentMember) => currentMember.id !== member.id),
      )
    } catch (error) {
      setMemberErrorMessage(getLoadErrorMessage(error))
    } finally {
      setUpdatingMemberId(null)
    }
  }

  async function handleSavePermission() {
    if (!permissionProject || isSavingPermission) {
      return
    }

    setIsSavingPermission(true)
    setPermissionErrorMessage(null)

    try {
      const updatedProject = await updateProject(permissionProject.id, {
        visibility: projectVisibility,
        publicAccessRole,
      })
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === updatedProject.id
            ? {
                ...updatedProject,
                lastViewedAt: project.lastViewedAt,
              }
            : project,
        ),
      )
      permissionDialogRef.current?.close()
    } catch (error) {
      setPermissionErrorMessage(getLoadErrorMessage(error))
    } finally {
      setIsSavingPermission(false)
    }
  }

  async function handleDeleteProject(project: ProjectSummary) {
    if (deletingProjectId) {
      return
    }

    setDeletingProjectId(project.id)
    setActionErrorMessage(null)

    try {
      await deleteProject(project.id)
      setProjects((currentProjects) =>
        currentProjects.filter(
          (currentProject) => currentProject.id !== project.id,
        ),
      )
    } catch (error) {
      setActionErrorMessage(getLoadErrorMessage(error))
    } finally {
      setDeletingProjectId(null)
    }
  }

  async function handleRemoveProjectFromList(project: ProjectSummary) {
    if (deletingProjectId || project.accessRole === 'owner') {
      return
    }

    setDeletingProjectId(project.id)
    setActionErrorMessage(null)

    try {
      await removeProjectFromList(project.id)
      setProjects((currentProjects) =>
        currentProjects.filter(
          (currentProject) => currentProject.id !== project.id,
        ),
      )
    } catch (error) {
      setActionErrorMessage(getLoadErrorMessage(error))
    } finally {
      setDeletingProjectId(null)
    }
  }

  async function handleDuplicateProject(project: ProjectSummary) {
    if (duplicatingProjectId) {
      return
    }

    setDuplicatingProjectId(project.id)
    setActionErrorMessage(null)

    try {
      const sourceProject = await getProject(project.id)
      const duplicatedProject = await createProject({
        name: getProjectCopyName(sourceProject.name),
        document: sourceProject.document,
      })
      setProjects((currentProjects) => [
        duplicatedProject,
        ...currentProjects,
      ])
    } catch (error) {
      setActionErrorMessage(getLoadErrorMessage(error))
    } finally {
      setDuplicatingProjectId(null)
    }
  }

  async function handleCopyProjectLink(projectId: string) {
    try {
      const projectUrl = new URL(
        `/projects/${projectId}`,
        window.location.origin,
      ).toString()

      await navigator.clipboard.writeText(projectUrl)
      setCopiedProjectId(projectId)
      window.setTimeout(() => setCopiedProjectId(null), 2000)
    } catch {
      setActionErrorMessage('無法複製分享連結，請稍後再試。')
    }
  }

  async function handleSignOut() {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)

    try {
      const { authClient } = await import('../lib/auth')
      await authClient.signOut()
      setAuthUserEmail(null)
      setProjects([])
      setIsTrashOpen(false)
      setErrorMessage(null)
    } finally {
      setIsSigningOut(false)
    }
  }

  async function openAiSettingsDialog() {
    if (isLoadingAiSettings) {
      return
    }

    setGeminiApiKey('')
    setAiSettingsError(null)
    setIsLoadingAiSettings(true)
    aiSettingsDialogRef.current?.showModal()

    try {
      setAiCredential(await getGeminiCredential())
    } catch (error) {
      setAiSettingsError(getLoadErrorMessage(error))
    } finally {
      setIsLoadingAiSettings(false)
    }
  }

  async function handleSaveAiCredential() {
    const apiKey = geminiApiKey.trim()

    if (!apiKey || isSavingAiSettings) {
      return
    }

    setIsSavingAiSettings(true)
    setAiSettingsError(null)

    try {
      setAiCredential(await saveGeminiCredential(apiKey))
      setGeminiApiKey('')
    } catch (error) {
      setAiSettingsError(getLoadErrorMessage(error))
    } finally {
      setIsSavingAiSettings(false)
    }
  }

  async function handleRemoveAiCredential() {
    if (
      isRemovingAiCredential ||
      !window.confirm('確定要移除 Gemini API Key 嗎？')
    ) {
      return
    }

    setIsRemovingAiCredential(true)
    setAiSettingsError(null)

    try {
      await deleteGeminiCredential()
      setAiCredential({
        provider: 'gemini',
        configured: false,
        keyHint: null,
        status: null,
        lastValidatedAt: null,
        updatedAt: null,
        validationResult: null,
      })
      setGeminiApiKey('')
    } catch (error) {
      setAiSettingsError(getLoadErrorMessage(error))
    } finally {
      setIsRemovingAiCredential(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex shrink-0 items-start gap-4">
            <img
              src={coCanvasMark}
              alt=""
              width="64"
              height="64"
              className="size-14 shrink-0 sm:size-16"
            />
            <div>
              <h1 className="text-3xl font-semibold text-foreground">
                專案
              </h1>
              <p className="mt-2 max-w-xl leading-7 text-foreground/60 lg:max-w-64 xl:max-w-sm">
                選擇一個專案，繼續整理你的思考脈絡。
              </p>
            </div>
          </div>

          <nav
            aria-label="專案頁功能"
            className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:flex-nowrap lg:items-center lg:justify-end"
          >
            {isAuthLoading ? (
              <span
                role="status"
                className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground/50 shadow-sm lg:w-auto"
              >
                確認登入中…
              </span>
            ) : authUserEmail ? (
              <span
                title={authUserEmail}
                className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-center text-sm text-foreground/65 shadow-sm lg:w-auto lg:max-w-48"
              >
                <span className="truncate">{authUserEmail}</span>
              </span>
            ) : null}
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 xl:px-4"
            >
              首頁
            </Link>
            <Link
              to="/projects/local"
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 xl:px-4"
            >
              本機畫布
            </Link>
            {authUserEmail && (
              <>
                <button
                  type="button"
                  onClick={() => void openAiSettingsDialog()}
                  className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 xl:px-4"
                >
                  AI 設定
                </button>
                <Link
                  to="/account/security"
                  className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 xl:px-4"
                >
                  帳號安全
                </Link>
                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={() => void handleSignOut()}
                  className="min-h-11 cursor-pointer whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 xl:px-4"
                >
                  {isSigningOut ? '登出中…' : '登出'}
                </button>
              </>
            )}
            {!isAuthLoading && !authUserEmail && (
              <Link
                to="/auth/sign-in"
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 xl:px-4"
              >
                登入
              </Link>
            )}
          </nav>
        </header>

        <section className="py-8" aria-labelledby="project-list-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="project-list-title"
              className="text-lg font-semibold text-foreground"
            >
              {isTrashOpen ? '垃圾桶' : '你的專案'}
            </h2>
            {authUserEmail && (
              <div className="flex flex-wrap gap-2">
                {!isTrashOpen && (
                  <>
                    <button
                      type="button"
                      onClick={() => openCreateProjectDialog('empty')}
                      className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      新增專案
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateProjectDialog('local')}
                      className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      將本機畫布存到雲端
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-label={isTrashOpen ? '返回專案' : '開啟垃圾桶'}
                  onClick={() => {
                    setActionErrorMessage(null)
                    setIsTrashOpen((current) => !current)
                  }}
                  className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-auto sm:px-4"
                >
                  {isTrashOpen ? (
                    <ArrowLeft aria-hidden="true" className="size-5 sm:hidden" />
                  ) : (
                    <Trash2 aria-hidden="true" className="size-5 sm:hidden" />
                  )}
                  <span className="hidden sm:inline">
                    {isTrashOpen ? '返回專案' : '垃圾桶'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {!isAuthLoading && authUserEmail && isTrashOpen && (
            <ProjectTrash
              onProjectRestored={(project) =>
                setProjects((currentProjects) => [
                  project,
                  ...currentProjects.filter(
                    (currentProject) => currentProject.id !== project.id,
                  ),
                ])
              }
            />
          )}

          {!isTrashOpen && (
            <>

          {!isAuthLoading &&
            authUserEmail &&
            !isLoading &&
            !errorMessage &&
            projects.length > 0 && (
            <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative block">
                <span className="sr-only">搜尋專案名稱</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-foreground/45"
                />
                <input
                  type="search"
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="搜尋專案名稱"
                  className="min-h-11 w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-base text-foreground shadow-sm outline-none transition placeholder:text-foreground/40 focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="sr-only">專案排序方式</span>
                <select
                  value={projectSort}
                  onChange={(event) =>
                    setProjectSort(event.target.value as ProjectSort)
                  }
                  className="min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground shadow-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20 sm:w-auto"
                >
                  <option value="viewed-desc">最近查看</option>
                  <option value="updated-desc">最近更新</option>
                  <option value="updated-asc">最早更新</option>
                  <option value="name-asc">名稱排序</option>
                </select>
              </label>
            </div>
          )}

          {isAuthLoading && (
            <div
              role="status"
              aria-label="正在確認登入狀態"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-xl border border-border bg-background/70"
                />
              ))}
            </div>
          )}

          {!isAuthLoading && !authUserEmail && (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-6 py-10 text-center">
              <h3 className="font-semibold text-foreground">
                登入後使用雲端專案
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-foreground/60">
                未登入時仍可使用本機畫布；登入後即可跨裝置存取專案。
              </p>
              <Link
                to="/auth/sign-in"
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                登入
              </Link>
            </div>
          )}

          {!isAuthLoading && authUserEmail && isLoading && (
            <div
              role="status"
              aria-label="正在載入專案"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-xl border border-border bg-background/70"
                />
              ))}
            </div>
          )}

          {!isAuthLoading && authUserEmail && !isLoading && errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-border bg-background p-6"
            >
              <h3 className="font-semibold text-foreground">
                無法載入專案
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground/65">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-4 min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                重新載入
              </button>
            </div>
          )}

          {!isAuthLoading &&
            authUserEmail &&
            !isLoading &&
            !errorMessage &&
            projects.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-6 py-12 text-center">
              <h3 className="font-semibold text-foreground">
                還沒有雲端專案
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground/60">
                點擊「新增專案」，建立第一個雲端畫布。
              </p>
            </div>
          )}

          {!isAuthLoading &&
            authUserEmail &&
            !isLoading &&
            !errorMessage &&
            projects.length > 0 &&
            visibleProjects.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-6 py-10 text-center">
              <h3 className="font-semibold text-foreground">
                找不到符合的專案
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground/60">
                請嘗試其他名稱，或清除目前的搜尋文字。
              </p>
              <button
                type="button"
                onClick={() => setProjectSearch('')}
                className="mt-4 min-h-11 cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                清除搜尋
              </button>
            </div>
          )}

          {!isAuthLoading &&
            authUserEmail &&
            !isLoading &&
            !errorMessage &&
            visibleProjects.length > 0 && (
            <>
              {openProjectMenuId && (
                <button
                  type="button"
                  aria-label="關閉專案選單"
                  onClick={() => setOpenProjectMenuId(null)}
                  className="fixed inset-0 z-20 cursor-default bg-transparent"
                />
              )}

              {actionErrorMessage && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-background px-4 py-3 text-sm text-red-600"
                >
                  {actionErrorMessage}
                </p>
              )}

              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProjects.map((project) => (
                  <li
                    key={project.id}
                    className={`relative rounded-xl border border-border bg-background shadow-sm transition hover:border-primary/30 hover:shadow-md ${
                      openProjectMenuId === project.id ? 'z-30' : 'z-0'
                    }`}
                  >
                    <Link
                      to={`/projects/${project.id}`}
                      className="group flex min-h-40 flex-col justify-between rounded-xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                    >
                      <div className="pr-11">
                        <h3 className="line-clamp-2 font-semibold text-foreground">
                          {project.name}
                        </h3>
                        <span className="mt-2 inline-flex rounded-full border border-border bg-primary/5 px-2.5 py-1 text-xs font-medium text-foreground/65">
                          {getProjectRoleLabel(project.accessRole)}
                        </span>
                      </div>
                      <div className="mt-6 flex items-center justify-between gap-3 text-sm text-foreground/55">
                        <span>
                          {project.lastViewedAt
                            ? `查看於 ${formatUpdatedAt(project.lastViewedAt)}`
                            : `更新於 ${formatUpdatedAt(project.updatedAt)}`}
                        </span>
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </Link>

                    <div
                      className="absolute right-2 top-2 z-10"
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setOpenProjectMenuId(null)
                        }
                      }}
                    >
                      <button
                        type="button"
                        aria-label={`開啟「${project.name}」專案選單`}
                        aria-expanded={openProjectMenuId === project.id}
                        onClick={() =>
                          setOpenProjectMenuId((currentId) =>
                            currentId === project.id ? null : project.id,
                          )
                        }
                        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="size-5"
                          fill="currentColor"
                        >
                          <circle cx="5" cy="12" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>

                      {openProjectMenuId === project.id && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-background p-1 shadow-lg">
                        {project.accessRole !== 'viewer' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenProjectMenuId(null)
                              openRenameDialog(project)
                            }}
                            className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            重新命名
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={duplicatingProjectId !== null}
                          onClick={() => {
                            setOpenProjectMenuId(null)
                            void handleDuplicateProject(project)
                          }}
                          className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {duplicatingProjectId === project.id
                            ? '複製中…'
                            : '建立副本'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenProjectMenuId(null)
                            void handleCopyProjectLink(project.id)
                          }}
                          className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          {copiedProjectId === project.id
                            ? '已複製連結'
                            : '複製分享連結'}
                        </button>
                        {project.accessRole === 'owner' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenProjectMenuId(null)
                              openPermissionDialog(project)
                            }}
                            className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            權限管理
                          </button>
                        )}
                        {project.accessRole === 'owner' && (
                          <>
                            <div className="my-1 border-t border-border" />
                            <button
                              type="button"
                              disabled={deletingProjectId !== null}
                              onClick={() => {
                                setOpenProjectMenuId(null)
                                void handleDeleteProject(project)
                              }}
                              className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingProjectId === project.id
                                ? '移動中…'
                                : '移到垃圾桶'}
                            </button>
                          </>
                        )}
                        {project.accessRole !== 'owner' && (
                          <>
                            <div className="my-1 border-t border-border" />
                            <button
                              type="button"
                              disabled={deletingProjectId !== null}
                              onClick={() => {
                                setOpenProjectMenuId(null)
                                void handleRemoveProjectFromList(project)
                              }}
                              className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingProjectId === project.id
                                ? '移除中…'
                                : '從列表移除'}
                            </button>
                          </>
                        )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
            </>
          )}
        </section>
      </div>

      <dialog
        ref={aiSettingsDialogRef}
        aria-labelledby="ai-settings-title"
        aria-describedby="ai-settings-description"
        onClose={() => {
          setGeminiApiKey('')
          setAiSettingsError(null)
        }}
        className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <div className="p-5 sm:p-6">
          <h2
            id="ai-settings-title"
            className="text-xl font-semibold text-foreground"
          >
            Gemini API Key
          </h2>
          <p
            id="ai-settings-description"
            className="mt-2 text-sm leading-6 text-foreground/60"
          >
            登入後的雲端專案會使用你的 Key；未設定時改用 Mock
            模式。
          </p>

          <div className="mt-5 rounded-xl border border-border bg-canvas/70 p-4">
            {isLoadingAiSettings ? (
              <p role="status" className="text-sm text-foreground/60">
                讀取設定中…
              </p>
            ) : aiCredential?.configured ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    已設定 ••••{aiCredential.keyHint}
                  </p>
                  <p className="mt-1 text-xs text-foreground/55">
                    {aiCredential.validationResult === 'quota_exceeded'
                      ? '額度不足，已暫時改用 Mock'
                      : aiCredential.validationResult === 'unavailable'
                        ? '暫時無法驗證，已儲存 Key'
                        : aiCredential.status === 'valid'
                      ? '已驗證'
                      : aiCredential.status === 'invalid'
                        ? '驗證失敗'
                        : '尚未驗證'}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  已設定
                </span>
              </div>
            ) : (
              <p className="text-sm leading-6 text-foreground/60">
                尚未設定，AI 對話與節點產生會使用 Mock 模式。
              </p>
            )}
          </div>

          <label
            htmlFor="gemini-api-key"
            className="mt-5 block text-sm font-medium text-foreground"
          >
            {aiCredential?.configured ? '替換 API Key' : 'API Key'}
          </label>
          <input
            id="gemini-api-key"
            type="password"
            value={geminiApiKey}
            autoComplete="off"
            spellCheck={false}
            disabled={isLoadingAiSettings || isSavingAiSettings}
            onChange={(event) => setGeminiApiKey(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition placeholder:text-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            placeholder={
              aiCredential?.configured
                ? '輸入新 Key 以替換'
                : '貼上 Gemini API Key'
            }
          />
          <p className="mt-2 text-xs leading-5 text-foreground/55">
            Key 會加密儲存在後端，設定完成後不會再顯示完整內容。
          </p>

          {aiSettingsError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {aiSettingsError}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {aiCredential?.configured && (
              <button
                type="button"
                disabled={
                  isRemovingAiCredential || isSavingAiSettings
                }
                onClick={() => void handleRemoveAiCredential()}
                className="min-h-11 cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50 sm:mr-auto"
              >
                {isRemovingAiCredential ? '移除中…' : '移除 Key'}
              </button>
            )}
            <button
              type="button"
              disabled={isSavingAiSettings || isRemovingAiCredential}
              onClick={() => aiSettingsDialogRef.current?.close()}
              className="min-h-11 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              關閉
            </button>
            <button
              type="button"
              disabled={
                !geminiApiKey.trim() ||
                isLoadingAiSettings ||
                isSavingAiSettings ||
                isRemovingAiCredential
              }
              onClick={() => void handleSaveAiCredential()}
              className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingAiSettings
                ? '驗證中…'
                : aiCredential?.configured
                  ? '替換 Key'
                  : '儲存 Key'}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        ref={createDialogRef}
        aria-labelledby="create-project-title"
        aria-describedby="create-project-description"
        onClose={() => {
          setProjectName('')
          setCreateProjectMode('empty')
          setCreateErrorMessage(null)
        }}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault()
            void handleCreateProject()
          }}
        >
          <h2
            id="create-project-title"
            className="text-xl font-semibold text-foreground"
          >
            {createProjectMode === 'local'
              ? '儲存本機畫布'
              : '新增專案'}
          </h2>
          <p
            id="create-project-description"
            className="mt-2 text-sm leading-6 text-foreground/60"
          >
            {createProjectMode === 'local'
              ? '建立一份雲端副本，本機畫布會繼續保留。'
              : '輸入名稱後，專案會儲存在 Neon。'}
          </p>

          <label
            htmlFor="project-name"
            className="mt-5 block text-sm font-medium text-foreground"
          >
            專案名稱
          </label>
          <input
            id="project-name"
            value={projectName}
            autoFocus
            required
            maxLength={120}
            disabled={isCreating}
            onChange={(event) => setProjectName(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition placeholder:text-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
            placeholder="例如：研究計畫整理"
          />

          {createErrorMessage && (
            <p
              role="alert"
              className="mt-3 text-sm leading-6 text-red-600"
            >
              {createErrorMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isCreating}
              onClick={() => createDialogRef.current?.close()}
              className="min-h-11 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!projectName.trim() || isCreating}
              className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating
                ? '儲存中…'
                : createProjectMode === 'local'
                  ? '儲存到雲端'
                  : '建立專案'}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={renameDialogRef}
        aria-labelledby="rename-project-title"
        onClose={() => {
          setRenamingProject(null)
          setRenamedProjectName('')
          setRenameErrorMessage(null)
        }}
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault()
            void handleRenameProject()
          }}
        >
          <h2
            id="rename-project-title"
            className="text-xl font-semibold text-foreground"
          >
            重新命名專案
          </h2>

          <label
            htmlFor="renamed-project-name"
            className="mt-5 block text-sm font-medium text-foreground"
          >
            專案名稱
          </label>
          <input
            id="renamed-project-name"
            value={renamedProjectName}
            autoFocus
            required
            maxLength={120}
            disabled={isRenaming}
            onChange={(event) =>
              setRenamedProjectName(event.target.value)
            }
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
          />

          {renameErrorMessage && (
            <p
              role="alert"
              className="mt-3 text-sm leading-6 text-red-600"
            >
              {renameErrorMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isRenaming}
              onClick={() => renameDialogRef.current?.close()}
              className="min-h-11 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!renamedProjectName.trim() || isRenaming}
              className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRenaming ? '儲存中…' : '儲存名稱'}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={permissionDialogRef}
        aria-labelledby="permission-dialog-title"
        aria-describedby="permission-dialog-description"
        onClose={() => {
          setPermissionProject(null)
          setProjectVisibility('private')
          setPublicAccessRole('viewer')
          setPermissionErrorMessage(null)
          setProjectMembers([])
          setHasLoadedMembers(false)
          setMemberEmail('')
          setNewMemberRole('viewer')
          setMemberErrorMessage(null)
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <div className="p-5 sm:p-6">
          <h2
            id="permission-dialog-title"
            className="text-xl font-semibold text-foreground"
          >
            權限管理
          </h2>
          <p
            id="permission-dialog-description"
            className="mt-2 text-sm leading-6 text-foreground/60"
          >
            設定誰能開啟「{permissionProject?.name}」，以及公開訪客能做什麼。
          </p>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-foreground">
              專案可見範圍
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-checked:border-primary has-checked:bg-primary/5">
                <input
                  type="radio"
                  name="project-visibility"
                  value="private"
                  checked={projectVisibility === 'private'}
                  disabled={isSavingPermission}
                  onChange={() => {
                    setProjectVisibility('private')

                    if (
                      permissionProject &&
                      !hasLoadedMembers &&
                      !isLoadingMembers
                    ) {
                      void loadProjectMembers(permissionProject.id)
                    }
                  }}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    私人
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-foreground/55">
                    只有被加入的成員可以開啟
                  </span>
                </span>
              </label>
              <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-checked:border-primary has-checkedq:bg-primary/5">
                <input
                  type="radio"
                  name="project-visibility"
                  value="public"
                  checked={projectVisibility === 'public'}
                  disabled={isSavingPermission}
                  onChange={() => setProjectVisibility('public')}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    公開
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-foreground/55">
                    任何取得連結的人都能開啟
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {projectVisibility === 'public' && (
            <fieldset className="mt-6 border-t border-border pt-6">
              <legend className="text-sm font-medium text-foreground">
                公開訪客權限
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-checked:border-primary has-checked:bg-primary/5">
                  <input
                    type="radio"
                    name="public-access-role"
                    value="viewer"
                    checked={publicAccessRole === 'viewer'}
                    disabled={isSavingPermission}
                    onChange={() => setPublicAccessRole('viewer')}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      可以檢視
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-foreground/55">
                      能查看畫布，但不能修改
                    </span>
                  </span>
                </label>
                <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-checked:border-primary has-checked:bg-primary/5">
                  <input
                    type="radio"
                    name="public-access-role"
                    value="editor"
                    checked={publicAccessRole === 'editor'}
                    disabled={isSavingPermission}
                    onChange={() => setPublicAccessRole('editor')}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      可以編輯
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-foreground/55">
                      能直接修改畫布與對話
                    </span>
                  </span>
                </label>
              </div>

              {publicAccessRole === 'editor' && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  任何取得連結的人都能修改內容，變更者不一定能被識別。
                </p>
              )}
            </fieldset>
          )}

          {projectVisibility === 'private' && (
            <section
              className="mt-6 border-t border-border pt-6"
              aria-labelledby="project-members-title"
            >
            <h3
              id="project-members-title"
              className="text-sm font-medium text-foreground"
            >
              專案成員
            </h3>

            <div className="mt-3 flex min-h-16 flex-col justify-center gap-1 rounded-xl border border-border bg-canvas px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {authUserEmail ?? '目前使用者'}
                </div>
                <div className="mt-0.5 text-xs text-foreground/50">
                  專案擁有者
                </div>
              </div>
              <span className="text-xs font-medium text-foreground/60">
                擁有者
              </span>
            </div>

            <form
              className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault()
                void handleAddMember()
              }}
            >
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-medium text-foreground/65">
                  成員 Email
                </span>
                <input
                  type="email"
                  required
                  maxLength={320}
                  value={memberEmail}
                  disabled={isAddingMember}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none transition placeholder:text-foreground/35 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-medium text-foreground/65">
                  角色
                </span>
                <select
                  value={newMemberRole}
                  disabled={isAddingMember}
                  onChange={(event) =>
                    setNewMemberRole(
                      event.target.value as ProjectMemberRole,
                    )
                  }
                  className="min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="viewer">檢視者</option>
                  <option value="editor">編輯者</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={!memberEmail.trim() || isAddingMember}
                className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isAddingMember ? '加入中…' : '加入'}
              </button>
            </form>

            {memberErrorMessage && (
              <p role="alert" className="mt-3 text-sm leading-6 text-red-600">
                {memberErrorMessage}
              </p>
            )}

            {isLoadingMembers ? (
              <p role="status" className="mt-4 text-sm text-foreground/55">
                正在載入成員…
              </p>
            ) : projectMembers.length === 0 ? (
              <p className="mt-4 text-sm text-foreground/50">
                尚未加入其他成員。
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {projectMembers.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <span
                      title={member.email}
                      className="min-w-0 flex-1 truncate text-sm text-foreground"
                    >
                      {member.email}
                    </span>
                    <label className="sm:w-28">
                      <span className="sr-only">
                        設定 {member.email} 的角色
                      </span>
                      <select
                        value={member.role}
                        disabled={updatingMemberId !== null}
                        onChange={(event) =>
                          void handleUpdateMemberRole(
                            member,
                            event.target.value as ProjectMemberRole,
                          )
                        }
                        className="min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="viewer">檢視者</option>
                        <option value="editor">編輯者</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={updatingMemberId !== null}
                      onClick={() => void handleRemoveMember(member)}
                      className="min-h-11 cursor-pointer rounded-lg px-3 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {updatingMemberId === member.id ? '處理中…' : '移除'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            </section>
          )}

          {permissionErrorMessage && (
            <p role="alert" className="mt-4 text-sm leading-6 text-red-600">
              {permissionErrorMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSavingPermission}
              onClick={() => permissionDialogRef.current?.close()}
              className="min-h-11 cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void handleSavePermission()}
              disabled={!permissionProject || isSavingPermission}
              className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingPermission ? '儲存中…' : '儲存權限'}
            </button>
          </div>
        </div>
      </dialog>
    </main>
  )
}
