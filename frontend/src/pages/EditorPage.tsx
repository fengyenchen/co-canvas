import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import { getProject, updateProject } from '../api/projects'
import { ApiRequestError } from '../api/errors'
import { Canvas } from '../components/canvas/Canvas'
import { ChatPanel } from '../components/chat/ChatPanel'
import {
  ProjectSettingsDialogs,
  type ProjectSettingsDialog,
} from '../components/project/ProjectSettingsDialogs'
import { useCanvasStore } from '../stores/canvasStore'
import { useChatStore } from '../stores/chatStore'
import {
  backupLocalProject,
  getActiveProjectId,
  LOCAL_PROJECT_ID,
  restoreLocalProject,
  setActiveProjectId,
} from '../utils/localProjectBackup'
import {
  clearCloudProjectRecovery,
  getCloudProjectRecovery,
  saveCloudProjectRecovery,
  type CloudProjectRecovery,
} from '../utils/cloudProjectRecovery'
import { createProjectDocument } from '../utils/projectFile'
import type { Project, ProjectRole } from '../types/project'

const MIN_CHAT_HEIGHT_PERCENT = 30
const MAX_CHAT_HEIGHT_PERCENT = 75
const DEFAULT_CHAT_HEIGHT_PERCENT = 55

type ProjectLoadState = 'loading' | 'ready' | 'error'
type ProjectSaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 800

function getProjectLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 404) {
    return '找不到此專案，可能已被刪除。'
  }

  if (error instanceof ApiRequestError) {
    return error.detail
  }

  if (error instanceof TypeError) {
    return '無法連線後端，請確認服務已啟動。'
  }

  return '專案資料格式無效，暫時無法開啟。'
}

function clampChatHeight(value: number): number {
  return Math.min(
    MAX_CHAT_HEIGHT_PERCENT,
    Math.max(MIN_CHAT_HEIGHT_PERCENT, value),
  )
}

export function EditorPage() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const layoutRef = useRef<HTMLDivElement>(null)
  const resizingPointerIdRef = useRef<number | null>(null)
  const savedDocumentSignatureRef = useRef('')
  const [projectLoadState, setProjectLoadState] =
    useState<ProjectLoadState>('loading')
  const [projectLoadError, setProjectLoadError] = useState('')
  const [projectSaveState, setProjectSaveState] =
    useState<ProjectSaveState>('idle')
  const [projectSaveRequiresLogin, setProjectSaveRequiresLogin] =
    useState(false)
  const [projectAccessRole, setProjectAccessRole] =
    useState<ProjectRole>('owner')
  const [loadedProject, setLoadedProject] = useState<Project | null>(null)
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null)
  const [pendingRecovery, setPendingRecovery] =
    useState<CloudProjectRecovery | null>(null)
  const [activeSettingsDialog, setActiveSettingsDialog] =
    useState<ProjectSettingsDialog>(null)
  const [aiSettingsRevision, setAiSettingsRevision] = useState(0)
  const [mobileChatHeight, setMobileChatHeight] = useState(
    DEFAULT_CHAT_HEIGHT_PERCENT,
  )
  const replaceProject = useCanvasStore(
    (state) => state.replaceProject,
  )
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const replaceProjectMessages = useChatStore(
    (state) => state.replaceProjectMessages,
  )
  const activeContextNodeId = useChatStore(
    (state) => state.activeContextNodeId,
  )
  const messages = useChatStore((state) => state.messages)
  const suggestionEvents = useChatStore(
    (state) => state.suggestionEvents,
  )
  const projectDocument = useMemo(
    () =>
      createProjectDocument(
        nodes,
        edges,
        messages,
        suggestionEvents,
      ),
    [edges, messages, nodes, suggestionEvents],
  )
  const projectDocumentSignature = useMemo(
    () => JSON.stringify(projectDocument),
    [projectDocument],
  )

  useEffect(() => {
    let isCancelled = false

    async function loadProject() {
      setProjectLoadState('loading')
      setProjectLoadError('')
      setProjectSaveState('idle')
      setProjectSaveRequiresLogin(false)
      setProjectAccessRole('owner')
      setLoadedProject(null)
      setRecoveryUserId(null)
      setPendingRecovery(null)
      setActiveSettingsDialog(null)

      if (!projectId) {
        setProjectLoadState('error')
        setProjectLoadError('網址缺少專案 ID。')
        return
      }

      const previousProjectId = getActiveProjectId()

      if (projectId === LOCAL_PROJECT_ID) {
        if (
          previousProjectId &&
          previousProjectId !== LOCAL_PROJECT_ID
        ) {
          const restoredLocalProject = restoreLocalProject()

          if (!restoredLocalProject) {
            replaceProject([], [])
            replaceProjectMessages([], [])
          }
        }

        setActiveProjectId(LOCAL_PROJECT_ID)
        setProjectLoadState('ready')
        return
      }

      if (
        !previousProjectId ||
        previousProjectId === LOCAL_PROJECT_ID
      ) {
        backupLocalProject()
      }

      try {
        let currentRecoveryUserId: string | null = null
        try {
          const { authClient } = await import('../lib/auth')
          const { data: sessionData } = await authClient.getSession()
          currentRecoveryUserId = sessionData?.user.id ?? 'anonymous'
        } catch {
          // Skip recovery if the account scope cannot be verified safely.
        }
        const project = await getProject(projectId)

        if (isCancelled) {
          return
        }

        replaceProject(
          project.document.nodes,
          project.document.edges,
        )
        replaceProjectMessages(
          project.document.messages,
          project.document.suggestionEvents,
        )
        setProjectAccessRole(project.accessRole)
        setLoadedProject(project)
        setRecoveryUserId(currentRecoveryUserId)
        savedDocumentSignatureRef.current = JSON.stringify(
          project.document,
        )
        const recovery = currentRecoveryUserId
          ? getCloudProjectRecovery(project.id, currentRecoveryUserId)
          : null
        if (
          project.accessRole !== 'viewer' &&
          recovery &&
          Date.parse(recovery.savedAt) > Date.parse(project.updatedAt) &&
          JSON.stringify(recovery.document) !==
            JSON.stringify(project.document)
        ) {
          setPendingRecovery(recovery)
        }
        setActiveProjectId(projectId)
        setProjectLoadState('ready')
      } catch (error) {
        if (isCancelled) {
          return
        }

        if (error instanceof ApiRequestError && error.status === 401) {
          const returnTo = `${location.pathname}${location.search}`
          void navigate(
            `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
            { replace: true },
          )
          return
        }

        setProjectLoadError(getProjectLoadErrorMessage(error))
        setProjectLoadState('error')
      }
    }

    void loadProject()

    return () => {
      isCancelled = true
    }
  }, [
    location.pathname,
    location.search,
    navigate,
    projectId,
    replaceProject,
    replaceProjectMessages,
  ])

  useEffect(() => {
    if (
      projectLoadState !== 'ready' ||
      projectAccessRole === 'viewer' ||
      !projectId ||
      projectId === LOCAL_PROJECT_ID ||
      !recoveryUserId ||
      projectDocumentSignature === savedDocumentSignatureRef.current
    ) {
      return
    }

    saveCloudProjectRecovery(projectId, recoveryUserId, projectDocument)

    let isCancelled = false
    const timeoutId = window.setTimeout(async () => {
      setProjectSaveState('saving')
      setProjectSaveRequiresLogin(false)

      try {
        await updateProject(projectId, {
          document: projectDocument,
        })

        if (isCancelled) {
          return
        }

        savedDocumentSignatureRef.current = projectDocumentSignature
        clearCloudProjectRecovery(projectId, recoveryUserId)
        setProjectSaveState('saved')
      } catch (error) {
        if (!isCancelled) {
          setProjectSaveState('error')
          setProjectSaveRequiresLogin(
            error instanceof ApiRequestError && error.status === 401,
          )
        }
      }
    }, SAVE_DELAY_MS)

    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    projectDocument,
    projectDocumentSignature,
    projectId,
    projectAccessRole,
    projectLoadState,
    recoveryUserId,
  ])

  if (projectLoadState === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p role="status" className="text-muted-foreground">
          正在載入專案…
        </p>
      </main>
    )
  }

  if (projectLoadState === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-canvas p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-foreground">
            無法載入專案
          </h1>
          <p className="mt-3 text-muted-foreground">
            {projectLoadError}
          </p>
          <Link
            to="/projects"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            返回專案列表
          </Link>
        </section>
      </main>
    )
  }

  function updateMobileChatHeight(clientY: number) {
    const layoutRect = layoutRef.current?.getBoundingClientRect()

    if (!layoutRect || layoutRect.height === 0) {
      return
    }

    const nextHeight =
      ((clientY - layoutRect.top) / layoutRect.height) * 100

    setMobileChatHeight(clampChatHeight(nextHeight))
  }

  function handleResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    resizingPointerIdRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    updateMobileChatHeight(event.clientY)
  }

  function handleResizeMove(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (resizingPointerIdRef.current !== event.pointerId) {
      return
    }

    updateMobileChatHeight(event.clientY)
  }

  function handleResizeEnd(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (resizingPointerIdRef.current !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    resizingPointerIdRef.current = null
  }

  return (
    <div
      ref={layoutRef}
      className="flex h-screen w-screen flex-col overflow-hidden bg-background lg:flex-row"
    >
      <ChatPanel
        mobileHeightPercent={mobileChatHeight}
        isReadOnly={projectAccessRole === 'viewer'}
        projectId={projectId}
        aiSettingsRevision={aiSettingsRevision}
      />

      {activeContextNodeId && (
        <div className="relative z-30 h-0 shrink-0 lg:hidden">
          <button
            type="button"
            role="separator"
            aria-label="調整對話與畫布高度"
            aria-orientation="horizontal"
            aria-valuemin={MIN_CHAT_HEIGHT_PERCENT}
            aria-valuemax={MAX_CHAT_HEIGHT_PERCENT}
            aria-valuenow={Math.round(mobileChatHeight)}
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setMobileChatHeight((height) =>
                  clampChatHeight(height - 5),
                )
              }

              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setMobileChatHeight((height) =>
                  clampChatHeight(height + 5),
                )
              }
            }}
            className="group absolute left-0 top-1/2 flex h-11 w-full -translate-y-1/2 touch-none cursor-row-resize items-center justify-center focus-visible:outline-none"
          >
            <span className="h-1.5 w-12 rounded-full border border-border bg-background shadow-sm transition group-hover:border-primary/40 group-hover:bg-primary/10 group-focus-visible:border-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/20" />
          </button>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Canvas
          isReadOnly={projectAccessRole === 'viewer'}
          canRenameProject={
            projectId !== LOCAL_PROJECT_ID && projectAccessRole !== 'viewer'
          }
          canManageProjectPermissions={
            projectId !== LOCAL_PROJECT_ID && projectAccessRole === 'owner'
          }
          canCopyProjectLink={projectId !== LOCAL_PROJECT_ID}
          canManageAiSettings={projectId !== LOCAL_PROJECT_ID}
          onRenameProject={() => setActiveSettingsDialog('rename')}
          onManageProjectPermissions={() =>
            setActiveSettingsDialog('permissions')
          }
          onManageAiSettings={() => setActiveSettingsDialog('ai')}
        />
      </div>

      {loadedProject && activeSettingsDialog && (
        <ProjectSettingsDialogs
          key={`${loadedProject.id}-${activeSettingsDialog}`}
          project={loadedProject}
          activeDialog={activeSettingsDialog}
          onClose={() => setActiveSettingsDialog(null)}
          onProjectUpdated={(project) => {
            setLoadedProject(project)
            setProjectAccessRole(project.accessRole)
          }}
          onAiCredentialUpdated={() =>
            setAiSettingsRevision((revision) => revision + 1)
          }
        />
      )}

      {pendingRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-[1px]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-recovery-title"
            aria-describedby="cloud-recovery-description"
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl"
          >
            <h2
              id="cloud-recovery-title"
              className="text-xl font-semibold text-foreground"
            >
              發現未儲存的內容
            </h2>
            <p
              id="cloud-recovery-description"
              className="mt-2 leading-7 text-muted-foreground"
            >
              此裝置保留了比雲端版本更新的暫存內容。請選擇要恢復暫存內容，或繼續使用目前的雲端版本。
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              暫存於 {new Date(pendingRecovery.savedAt).toLocaleString('zh-TW')}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  clearCloudProjectRecovery(
                    pendingRecovery.projectId,
                    pendingRecovery.userId,
                  )
                  setPendingRecovery(null)
                }}
                className="min-h-11 cursor-pointer rounded-xl border border-border px-4 text-foreground transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                使用雲端版本
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  replaceProject(
                    pendingRecovery.document.nodes,
                    pendingRecovery.document.edges,
                  )
                  replaceProjectMessages(
                    pendingRecovery.document.messages,
                    pendingRecovery.document.suggestionEvents,
                  )
                  setPendingRecovery(null)
                }}
                className="min-h-11 cursor-pointer rounded-xl bg-primary px-4 font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                恢復內容
              </button>
            </div>
          </section>
        </div>
      )}

      {projectId !== LOCAL_PROJECT_ID && projectSaveState !== 'idle' && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur-sm ${
            projectSaveState === 'error'
              ? 'border-red-300 text-red-600'
              : 'pointer-events-none border-border text-muted-foreground'
          }`}
        >
          {projectSaveState === 'saving' && '儲存中…'}
          {projectSaveState === 'saved' && '已儲存'}
          {projectSaveState === 'error' &&
            (projectSaveRequiresLogin ? '登入已過期，尚未儲存' : '儲存失敗')}
          {projectSaveRequiresLogin && (
            <Link
              to={`/auth/sign-in?returnTo=${encodeURIComponent(
                `${location.pathname}${location.search}`,
              )}`}
              className="inline-flex min-h-8 items-center rounded-md border border-red-300 px-2 font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              重新登入
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
