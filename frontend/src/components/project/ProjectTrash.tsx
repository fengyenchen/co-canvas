import { RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  listTrashedProjects,
  permanentlyDeleteProject,
  restoreProject,
} from '../../api/projects'
import { ApiRequestError } from '../../api/errors'
import type { TrashedProjectSummary } from '../../types/project'
import type { Project } from '../../types/project'

const DAY_MS = 24 * 60 * 60 * 1000

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.detail
  }

  if (error instanceof TypeError) {
    return '無法連線後端，請確認服務已啟動。'
  }

  return '垃圾桶資料格式無效，請稍後再試。'
}

function getRemainingDays(expiresAt: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / DAY_MS))
}

type ProjectTrashProps = {
  onProjectRestored: (project: Project) => void
}

export function ProjectTrash({ onProjectRestored }: ProjectTrashProps) {
  const [projects, setProjects] = useState<TrashedProjectSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [restoringProjectId, setRestoringProjectId] = useState<string | null>(
    null,
  )
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  )
  const [pendingPermanentDelete, setPendingPermanentDelete] =
    useState<TrashedProjectSummary | null>(null)
  const [permanentDeleteError, setPermanentDeleteError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let isCancelled = false

    async function loadTrash() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const result = await listTrashedProjects()
        if (!isCancelled) {
          setProjects(result)
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(getErrorMessage(error))
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadTrash()
    return () => {
      isCancelled = true
    }
  }, [loadAttempt])

  async function handleRestore(project: TrashedProjectSummary) {
    if (restoringProjectId || deletingProjectId) {
      return
    }

    setRestoringProjectId(project.id)
    setErrorMessage('')

    try {
      const restoredProject = await restoreProject(project.id)
      setProjects((current) => current.filter((item) => item.id !== project.id))
      onProjectRestored(restoredProject)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setRestoringProjectId(null)
    }
  }

  async function handlePermanentDelete(project: TrashedProjectSummary) {
    if (restoringProjectId || deletingProjectId) {
      return
    }

    setDeletingProjectId(project.id)
    setPermanentDeleteError('')

    try {
      await permanentlyDeleteProject(project.id)
      setProjects((current) => current.filter((item) => item.id !== project.id))
      setPendingPermanentDelete(null)
    } catch (error) {
      setPermanentDeleteError(getErrorMessage(error))
    } finally {
      setDeletingProjectId(null)
    }
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="正在載入垃圾桶"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-xl border border-border bg-background/70"
          />
        ))}
      </div>
    )
  }

  if (errorMessage && projects.length === 0) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-background p-6">
        <h3 className="font-semibold text-foreground">無法載入垃圾桶</h3>
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
    )
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/70 px-6 py-12 text-center">
        <Trash2 aria-hidden="true" className="mx-auto size-8 text-border" />
        <h3 className="mt-4 font-semibold text-foreground">垃圾桶是空的</h3>
        <p className="mt-2 text-sm leading-6 text-foreground/60">
          刪除的專案會保留 30 天，期間可以隨時復原。
        </p>
      </div>
    )
  }

  return (
    <>
      {errorMessage && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-background px-4 py-3 text-sm text-red-600"
        >
          {errorMessage}
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const remainingDays = getRemainingDays(project.expiresAt)
          const isRestoring = restoringProjectId === project.id
          const isDeleting = deletingProjectId === project.id

          return (
            <li
              key={project.id}
              className="flex min-h-44 flex-col justify-between rounded-xl border border-border bg-background p-5 shadow-sm"
            >
              <div>
                <h3 className="line-clamp-2 font-semibold text-foreground">
                  {project.name}
                </h3>
                <p className="mt-2 text-sm text-foreground/60">
                  {remainingDays > 0
                    ? `剩餘 ${remainingDays} 天`
                    : '即將永久刪除'}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={Boolean(restoringProjectId || deletingProjectId)}
                  onClick={() => void handleRestore(project)}
                  className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  {isRestoring ? '復原中…' : '復原'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(restoringProjectId || deletingProjectId)}
                  onClick={() => {
                    setPermanentDeleteError('')
                    setPendingPermanentDelete(project)
                  }}
                  className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {isDeleting ? '刪除中…' : '永久刪除'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {pendingPermanentDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingProjectId) {
              setPendingPermanentDelete(null)
              setPermanentDeleteError('')
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="permanent-delete-title"
            aria-describedby="permanent-delete-description"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !deletingProjectId) {
                setPendingPermanentDelete(null)
                setPermanentDeleteError('')
              }
            }}
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
          >
            <h2
              id="permanent-delete-title"
              className="text-xl font-semibold text-foreground"
            >
              永久刪除專案？
            </h2>
            <p
              id="permanent-delete-description"
              className="mt-2 break-words leading-7 text-foreground/65"
            >
              「{pendingPermanentDelete.name}」及其中的節點、對話與權限資料都會永久刪除，且無法復原。
            </p>
            {permanentDeleteError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {permanentDeleteError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                disabled={Boolean(deletingProjectId)}
                onClick={() => {
                  setPendingPermanentDelete(null)
                  setPermanentDeleteError('')
                }}
                className="min-h-11 cursor-pointer rounded-xl border border-border px-4 text-foreground transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={Boolean(deletingProjectId)}
                onClick={() =>
                  void handlePermanentDelete(pendingPermanentDelete)
                }
                className="min-h-11 cursor-pointer rounded-xl bg-red-600 px-4 font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingProjectId ? '永久刪除中…' : '永久刪除'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
