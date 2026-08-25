import { useEffect, useRef, useState } from 'react'
import {
  getProjectVersion,
  listProjectVersions,
} from '../../api/projects'
import { ApiRequestError } from '../../api/errors'
import type {
  Project,
  ProjectVersion,
  ProjectVersionKind,
  ProjectVersionSummary,
} from '../../types/project'

type ProjectVersionsDialogProps = {
  project: Project
  canEdit: boolean
  onClose: () => void
  onCreateVersion: (name: string) => Promise<ProjectVersion>
  onRestoreVersion: (versionId: string) => Promise<void>
}

const VERSION_KIND_LABELS: Record<ProjectVersionKind, string> = {
  manual: '手動版本',
  automatic: '自動版本',
  pre_restore: '恢復前備份',
  pre_import: '匯入前備份',
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.detail
  }

  if (error instanceof TypeError) {
    return '無法連線後端，請確認服務已啟動。'
  }

  return '版本紀錄操作失敗，請稍後再試。'
}

function formatVersionTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '時間不明'
  }

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function ProjectVersionsDialog({
  project,
  canEdit,
  onClose,
  onCreateVersion,
  onRestoreVersion,
}: ProjectVersionsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [versions, setVersions] = useState<ProjectVersionSummary[]>([])
  const [selectedVersion, setSelectedVersion] =
    useState<ProjectVersion | null>(null)
  const [versionName, setVersionName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null)
  const [restoringVersion, setRestoringVersion] =
    useState<ProjectVersionSummary | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCancelled = false
    dialogRef.current?.showModal()

    void listProjectVersions(project.id)
      .then((result) => {
        if (!isCancelled) {
          setVersions(result)
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setErrorMessage(getErrorMessage(error))
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [project.id])

  async function handleCreateVersion() {
    if (isCreating || isRestoring) {
      return
    }

    setIsCreating(true)
    setErrorMessage('')

    try {
      const version = await onCreateVersion(versionName)
      setVersions((current) => [version, ...current])
      setSelectedVersion(version)
      setVersionName('')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleViewVersion(version: ProjectVersionSummary) {
    if (loadingVersionId || isRestoring) {
      return
    }

    setLoadingVersionId(version.id)
    setErrorMessage('')

    try {
      setSelectedVersion(await getProjectVersion(project.id, version.id))
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setLoadingVersionId(null)
    }
  }

  async function handleRestoreVersion() {
    if (!restoringVersion || isRestoring) {
      return
    }

    setIsRestoring(true)
    setErrorMessage('')

    try {
      await onRestoreVersion(restoringVersion.id)
      dialogRef.current?.close()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setRestoringVersion(null)
    } finally {
      setIsRestoring(false)
    }
  }

  const isBusy = isCreating || isRestoring || loadingVersionId !== null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="project-versions-title"
      aria-describedby="project-versions-description"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          event.currentTarget.close()
        }
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="project-versions-title" className="text-xl font-semibold">
              版本紀錄
            </h2>
            <p
              id="project-versions-description"
              className="mt-2 text-sm leading-6 text-foreground/60"
            >
              查看或恢復「{project.name}」先前保存的畫布狀態。
            </p>
          </div>
          <button
            type="button"
            aria-label="關閉版本紀錄"
            disabled={isBusy}
            onClick={() => dialogRef.current?.close()}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xl text-foreground/60 transition hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ×
          </button>
        </div>

        {canEdit && (
          <form
            className="mt-5 rounded-xl border border-border bg-canvas/60 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCreateVersion()
            }}
          >
            <label htmlFor="project-version-name" className="text-sm font-medium">
              建立目前版本
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="project-version-name"
                value={versionName}
                maxLength={120}
                disabled={isBusy}
                onChange={(event) => setVersionName(event.target.value)}
                placeholder="版本名稱（選填）"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-base outline-none transition placeholder:text-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? '建立中…' : '建立版本'}
              </button>
            </div>
          </form>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
          <section aria-labelledby="version-list-title">
            <h3 id="version-list-title" className="text-sm font-medium">
              已保存版本
            </h3>
            {isLoading ? (
              <p role="status" className="mt-3 text-sm text-foreground/55">
                正在載入版本…
              </p>
            ) : versions.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-foreground/55">
                尚未建立版本紀錄。
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {versions.map((version) => (
                  <li
                    key={version.id}
                    className="flex flex-col gap-3 rounded-xl border border-border px-4 py-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {version.name || VERSION_KIND_LABELS[version.kind]}
                      </p>
                      <p className="mt-1 text-xs text-foreground/55">
                        {VERSION_KIND_LABELS[version.kind]} ·{' '}
                        {formatVersionTime(version.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleViewVersion(version)}
                        className="min-h-11 flex-1 cursor-pointer rounded-lg border border-border px-3 text-sm transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loadingVersionId === version.id ? '讀取中…' : '查看'}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setRestoringVersion(version)}
                          className="min-h-11 flex-1 cursor-pointer rounded-lg px-3 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          恢復
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="rounded-xl border border-border bg-canvas/60 p-4">
            <h3 className="text-sm font-medium">版本內容</h3>
            {selectedVersion ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="font-medium">
                  {selectedVersion.name || VERSION_KIND_LABELS[selectedVersion.kind]}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-foreground/60">
                  <dt>節點</dt>
                  <dd className="text-right text-foreground">
                    {selectedVersion.document.nodes.length}
                  </dd>
                  <dt>連線</dt>
                  <dd className="text-right text-foreground">
                    {selectedVersion.document.edges.length}
                  </dd>
                  <dt>對話</dt>
                  <dd className="text-right text-foreground">
                    {selectedVersion.document.messages.length}
                  </dd>
                </dl>
                <p className="border-t border-border pt-3 text-xs leading-5 text-foreground/55">
                  {formatVersionTime(selectedVersion.createdAt)}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-foreground/50">
                選擇「查看」以確認版本中的節點、連線與對話數量。
              </p>
            )}
          </aside>
        </div>
      </div>

      {restoringVersion && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-[1px]">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="restore-version-title"
            aria-describedby="restore-version-description"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
          >
            <h3 id="restore-version-title" className="text-xl font-semibold">
              恢復這個版本？
            </h3>
            <p
              id="restore-version-description"
              className="mt-2 text-sm leading-6 text-foreground/60"
            >
              畫布與對話會回到「{restoringVersion.name || VERSION_KIND_LABELS[restoringVersion.kind]}」。目前狀態會先自動保存，因此仍可恢復。
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setRestoringVersion(null)}
                className="min-h-11 cursor-pointer rounded-lg border border-border px-4 text-sm font-medium transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                autoFocus
                disabled={isRestoring}
                onClick={() => void handleRestoreVersion()}
                className="min-h-11 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRestoring ? '恢復中…' : '確認恢復'}
              </button>
            </div>
          </section>
        </div>
      )}
    </dialog>
  )
}
