import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
} from '../api/projects'
import { ApiRequestError } from '../api/errors'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'
import type {
  ProjectSummary,
  ProjectVisibility,
  PublicAccessRole,
} from '../types/project'
import { getLocalProjectDocument } from '../utils/localProjectBackup'

type CreateProjectMode = 'empty' | 'local'

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
  const [deletingProjectId, setDeletingProjectId] = useState<
    string | null
  >(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<
    string | null
  >(null)
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(
    null,
  )
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)

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
            ? updatedProject
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
    permissionDialogRef.current?.showModal()
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
          project.id === updatedProject.id ? updatedProject : project,
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
    if (
      deletingProjectId ||
      !window.confirm(`確定要刪除「${project.name}」嗎？此操作無法復原。`)
    ) {
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
      setErrorMessage(null)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
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
              <p className="mt-2 text-foreground/60">
                選擇一個專案，繼續整理你的思考脈絡。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/projects/local"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              開啟本機畫布
            </Link>
            {isAuthLoading ? (
              <span
                role="status"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground/50 shadow-sm"
              >
                確認登入中…
              </span>
            ) : authUserEmail ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <span
                  title={authUserEmail}
                  className="inline-flex min-h-11 w-full min-w-0 max-w-none items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground/65 shadow-sm sm:w-auto sm:max-w-48 sm:justify-start"
                >
                  <span className="truncate">{authUserEmail}</span>
                </span>
                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={() => void handleSignOut()}
                  className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSigningOut ? '登出中…' : '登出'}
                </button>
              </div>
            ) : (
              <Link
                to="/auth/sign-in"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                登入
              </Link>
            )}
            {authUserEmail && (
              <button
                type="button"
                onClick={() => openCreateProjectDialog('empty')}
                className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                新增專案
              </button>
            )}
          </div>
        </header>

        <section className="py-8" aria-labelledby="project-list-title">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="project-list-title"
              className="text-lg font-semibold text-foreground"
            >
              你的專案
            </h2>
            {authUserEmail && (
              <button
                type="button"
                onClick={() => openCreateProjectDialog('local')}
                className="min-h-11 cursor-pointer self-start rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:self-auto"
              >
                將本機畫布存到雲端
              </button>
            )}
          </div>

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
            projects.length > 0 && (
            <>
              {actionErrorMessage && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-background px-4 py-3 text-sm text-red-600"
                >
                  {actionErrorMessage}
                </p>
              )}

              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className="relative rounded-xl border border-border bg-background shadow-sm transition hover:border-primary/30 hover:shadow-md"
                  >
                    <Link
                      to={`/projects/${project.id}`}
                      className="group flex min-h-40 flex-col justify-between rounded-xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                    >
                      <h3 className="line-clamp-2 pr-11 font-semibold text-foreground">
                        {project.name}
                      </h3>
                      <div className="mt-6 flex items-center justify-between gap-3 text-sm text-foreground/55">
                        <span>
                          更新於 {formatUpdatedAt(project.updatedAt)}
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

                    <details
                      className="group/menu absolute right-2 top-2 z-10"
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.currentTarget.removeAttribute('open')
                        }
                      }}
                    >
                      <summary
                        aria-label={`開啟「${project.name}」專案選單`}
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
                      </summary>

                      <div className="absolute right-0 top-full mt-1 w-48 overflow-hidden rounded-xl border border-border bg-background p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.currentTarget
                              .closest('details')
                              ?.removeAttribute('open')
                            openRenameDialog(project)
                          }}
                          className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          重新命名
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.currentTarget
                              .closest('details')
                              ?.removeAttribute('open')
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
                            onClick={(event) => {
                              event.currentTarget
                                .closest('details')
                                ?.removeAttribute('open')
                              openPermissionDialog(project)
                            }}
                            className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            權限管理
                          </button>
                        )}
                        <div className="my-1 border-t border-border" />
                        <button
                          type="button"
                          disabled={deletingProjectId !== null}
                          onClick={(event) => {
                            event.currentTarget
                              .closest('details')
                              ?.removeAttribute('open')
                            void handleDeleteProject(project)
                          }}
                          className="min-h-11 w-full cursor-pointer rounded-lg px-3 text-left text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingProjectId === project.id
                            ? '刪除中…'
                            : '刪除專案'}
                        </button>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

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
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
      >
        <form
          className="p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSavePermission()
          }}
        >
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
              <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="project-visibility"
                  value="private"
                  checked={projectVisibility === 'private'}
                  disabled={isSavingPermission}
                  onChange={() => setProjectVisibility('private')}
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
              <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
                <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
                <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5">
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
              type="submit"
              disabled={!permissionProject || isSavingPermission}
              className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingPermission ? '儲存中…' : '儲存權限'}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  )
}
