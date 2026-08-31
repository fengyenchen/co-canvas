import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import {
  createProjectVersion,
  createProject,
  deleteProject,
  downloadProjectResearchEvents,
  getProject,
  restoreProjectVersion,
  syncProjectResearchEvents,
  updateProject,
} from '../api/projects'
import { ApiRequestError } from '../api/errors'
import { ensureWelcomeEmail } from '../api/authAdmin'
import { Canvas } from '../components/canvas/Canvas'
import { ChatPanel } from '../components/chat/ChatPanel'
import {
  ProjectSettingsDialogs,
  type ProjectSettingsDialog,
} from '../components/project/ProjectSettingsDialogs'
import { ProjectVersionsDialog } from '../components/project/ProjectVersionsDialog'
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
import { mergeProjectDocuments } from '../utils/mergeProjectDocuments'
import {
  createExampleProjectDocument,
  EXAMPLE_PROJECT_ID,
} from '../utils/exampleProject'
import type {
  Project,
  ProjectDocument,
  ProjectRole,
  ProjectVersion,
} from '../types/project'

const MIN_CHAT_HEIGHT_PERCENT = 30
const MAX_CHAT_HEIGHT_PERCENT = 75
const DEFAULT_CHAT_HEIGHT_PERCENT = 55

type ProjectLoadState = 'loading' | 'ready' | 'error'
type ProjectSaveState = 'idle' | 'merging' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 800
const LIVE_SYNC_INTERVAL_MS = 2_000
const AUTOMATIC_VERSION_INTERVAL_MS = 10 * 60 * 1000
const PROJECT_COPY_SUFFIX = '（副本）'

function getProjectCopyName(name: string): string {
  return `${name.slice(0, 120 - PROJECT_COPY_SUFFIX.length)}${PROJECT_COPY_SUFFIX}`
}

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

type EditorPageProps = {
  mode?: 'project' | 'example'
}

export function EditorPage({ mode = 'project' }: EditorPageProps) {
  const { projectId: routeProjectId } = useParams()
  const projectId = mode === 'example' ? EXAMPLE_PROJECT_ID : routeProjectId
  const isExampleProject = projectId === EXAMPLE_PROJECT_ID
  const isStandaloneProject =
    projectId === LOCAL_PROJECT_ID || isExampleProject
  const location = useLocation()
  const navigate = useNavigate()
  const layoutRef = useRef<HTMLDivElement>(null)
  const resizingPointerIdRef = useRef<number | null>(null)
  const savedDocumentSignatureRef = useRef('')
  const savedProjectDocumentRef = useRef<ProjectDocument | null>(null)
  const savedProjectUpdatedAtRef = useRef<string | null>(null)
  const currentProjectDocumentRef = useRef<ProjectDocument | null>(null)
  const cloudRequestInProgressRef = useRef(false)
  const saveRetryTimeoutRef = useRef<number | null>(null)
  const versionActionInProgressRef = useRef(false)
  const automaticVersionInProgressRef = useRef(false)
  const currentDocumentSignatureRef = useRef('')
  const lastAutomaticVersionSignatureRef = useRef('')
  const [projectLoadState, setProjectLoadState] =
    useState<ProjectLoadState>('loading')
  const [projectLoadError, setProjectLoadError] = useState('')
  const [projectSaveState, setProjectSaveState] =
    useState<ProjectSaveState>('idle')
  const [saveRetryRevision, setSaveRetryRevision] = useState(0)
  const [projectSaveRequiresLogin, setProjectSaveRequiresLogin] =
    useState(false)
  const [projectAccessRole, setProjectAccessRole] =
    useState<ProjectRole>('owner')
  const [loadedProject, setLoadedProject] = useState<Project | null>(null)
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{
    id: string
    email?: string | null
    name?: string | null
  } | null>(null)
  const [pendingRecovery, setPendingRecovery] =
    useState<CloudProjectRecovery | null>(null)
  const [projectAction, setProjectAction] = useState<
    'idle' | 'duplicating' | 'deleting'
  >('idle')
  const [projectActionError, setProjectActionError] = useState('')
  const [researchSyncRevision, setResearchSyncRevision] = useState(0)
  const [activeSettingsDialog, setActiveSettingsDialog] =
    useState<ProjectSettingsDialog>(null)
  const [aiSettingsRevision, setAiSettingsRevision] = useState(0)
  const [isVersionsDialogOpen, setIsVersionsDialogOpen] = useState(false)
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
  const setActiveContextNodeId = useChatStore(
    (state) => state.setActiveContextNodeId,
  )
  const messages = useChatStore((state) => state.messages)
  const suggestionEvents = useChatStore(
    (state) => state.suggestionEvents,
  )

  useEffect(() => {
    if (!currentUser?.id || isStandaloneProject) {
      return
    }

    void ensureWelcomeEmail().catch(() => undefined)
  }, [currentUser?.id, isStandaloneProject])

  useEffect(() => {
    if (
      projectLoadState !== 'ready' ||
      projectAccessRole === 'viewer' ||
      !projectId ||
      isStandaloneProject ||
      suggestionEvents.length === 0
    ) {
      return
    }

    let isCancelled = false
    let retryTimeoutId: number | undefined

    void syncProjectResearchEvents(projectId, suggestionEvents).catch(() => {
      if (!isCancelled) {
        retryTimeoutId = window.setTimeout(
          () => setResearchSyncRevision((revision) => revision + 1),
          5000,
        )
      }
    })

    return () => {
      isCancelled = true
      if (retryTimeoutId !== undefined) window.clearTimeout(retryTimeoutId)
    }
  }, [
    projectAccessRole,
    isStandaloneProject,
    projectId,
    projectLoadState,
    researchSyncRevision,
    suggestionEvents,
  ])
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
    currentDocumentSignatureRef.current = projectDocumentSignature
    currentProjectDocumentRef.current = projectDocument
  }, [projectDocument, projectDocumentSignature])

  useEffect(() => () => {
    if (saveRetryTimeoutRef.current !== null) {
      window.clearTimeout(saveRetryTimeoutRef.current)
    }
  }, [])

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
      setCurrentUser(null)
      setPendingRecovery(null)
      setActiveSettingsDialog(null)
      setIsVersionsDialogOpen(false)
      versionActionInProgressRef.current = false
      automaticVersionInProgressRef.current = false
      lastAutomaticVersionSignatureRef.current = ''
      savedProjectUpdatedAtRef.current = null
      savedProjectDocumentRef.current = null
      if (saveRetryTimeoutRef.current !== null) {
        window.clearTimeout(saveRetryTimeoutRef.current)
        saveRetryTimeoutRef.current = null
      }

      if (!projectId) {
        setProjectLoadState('error')
        setProjectLoadError('網址缺少專案 ID。')
        return
      }

      const previousProjectId = getActiveProjectId()

      if (isExampleProject) {
        if (
          !previousProjectId ||
          previousProjectId === LOCAL_PROJECT_ID
        ) {
          backupLocalProject()
        }

        try {
          const { authClient } = await import('../lib/auth')
          const { data: sessionData } = await authClient.getSession()
          if (sessionData?.user.id) {
            setCurrentUser({
              id: sessionData.user.id,
              email: sessionData.user.email,
              name: sessionData.user.name,
            })
          }
        } catch {
          // The example remains usable without an account.
        }

        const exampleDocument = createExampleProjectDocument()
        replaceProject(exampleDocument.nodes, exampleDocument.edges)
        replaceProjectMessages(
          exampleDocument.messages,
          exampleDocument.suggestionEvents,
        )
        setActiveContextNodeId(
          exampleDocument.nodes.find((node) => node.type === 'concept')?.id ??
            null,
        )
        setActiveProjectId(EXAMPLE_PROJECT_ID)
        setProjectLoadState('ready')
        return
      }

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
          if (sessionData?.user.id) {
            setCurrentUser({
              id: sessionData.user.id,
              email: sessionData.user.email,
              name: sessionData.user.name,
            })
          }
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
        savedProjectUpdatedAtRef.current = project.updatedAt
        savedProjectDocumentRef.current = project.document
        setRecoveryUserId(currentRecoveryUserId)
        savedDocumentSignatureRef.current = JSON.stringify(
          project.document,
        )
        lastAutomaticVersionSignatureRef.current =
          savedDocumentSignatureRef.current
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
    isExampleProject,
    navigate,
    projectId,
    replaceProject,
    replaceProjectMessages,
    setActiveContextNodeId,
  ])

  useEffect(() => {
    if (
      projectLoadState !== 'ready' ||
      projectAccessRole === 'viewer' ||
      !projectId ||
      isStandaloneProject
    ) {
      return
    }

    const intervalId = window.setInterval(() => {
      const currentSignature = currentDocumentSignatureRef.current

      if (
        versionActionInProgressRef.current ||
        automaticVersionInProgressRef.current ||
        !currentSignature ||
        currentSignature !== savedDocumentSignatureRef.current ||
        currentSignature === lastAutomaticVersionSignatureRef.current
      ) {
        return
      }

      automaticVersionInProgressRef.current = true
      void createProjectVersion(projectId, undefined, 'automatic')
        .then(() => {
          lastAutomaticVersionSignatureRef.current = currentSignature
        })
        .catch(() => {
          // Automatic snapshots retry on the next interval.
        })
        .finally(() => {
          automaticVersionInProgressRef.current = false
        })
    }, AUTOMATIC_VERSION_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [isStandaloneProject, projectAccessRole, projectId, projectLoadState])

  const applyRemoteProject = useCallback((
    project: Project,
    mergeCurrentChanges: boolean,
  ) => {
    const baseDocument = savedProjectDocumentRef.current ?? project.document
    const localDocument = currentProjectDocumentRef.current ?? project.document
    const nextDocument = mergeCurrentChanges
      ? mergeProjectDocuments(baseDocument, localDocument, project.document)
      : project.document
    const remoteSignature = JSON.stringify(project.document)
    const nextSignature = JSON.stringify(nextDocument)

    savedProjectDocumentRef.current = project.document
    savedProjectUpdatedAtRef.current = project.updatedAt
    savedDocumentSignatureRef.current = remoteSignature
    setLoadedProject(project)
    setProjectAccessRole(project.accessRole)
    const selectedNodeIds = new Set(
      useCanvasStore
        .getState()
        .nodes.filter((node) => node.selected)
        .map((node) => node.id),
    )
    replaceProject(
      nextDocument.nodes.map((node) => ({
        ...node,
        selected: selectedNodeIds.has(node.id),
      })),
      nextDocument.edges,
    )
    replaceProjectMessages(
      nextDocument.messages,
      nextDocument.suggestionEvents,
      true,
    )

    if (nextSignature === remoteSignature) {
      if (recoveryUserId && projectId) {
        clearCloudProjectRecovery(projectId, recoveryUserId)
      }
      setProjectSaveState('saved')
      return
    }

    if (recoveryUserId && projectId) {
      saveCloudProjectRecovery(projectId, recoveryUserId, nextDocument)
    }
    setProjectSaveState('merging')
  }, [
    projectId,
    recoveryUserId,
    replaceProject,
    replaceProjectMessages,
  ])

  useEffect(() => {
    if (
      projectLoadState !== 'ready' ||
      !projectId ||
      isStandaloneProject
    ) {
      return
    }

    let isCancelled = false

    const syncLatestProject = async () => {
      if (
        document.visibilityState === 'hidden' ||
        cloudRequestInProgressRef.current ||
        versionActionInProgressRef.current
      ) {
        return
      }

      cloudRequestInProgressRef.current = true
      try {
        const remoteProject = await getProject(projectId)
        if (
          isCancelled ||
          remoteProject.updatedAt === savedProjectUpdatedAtRef.current
        ) {
          return
        }

        const hasLocalChanges =
          currentDocumentSignatureRef.current !==
          savedDocumentSignatureRef.current
        applyRemoteProject(remoteProject, hasLocalChanges)
      } catch {
        // A temporary polling failure is retried on the next interval.
      } finally {
        cloudRequestInProgressRef.current = false
      }
    }

    const intervalId = window.setInterval(
      () => void syncLatestProject(),
      LIVE_SYNC_INTERVAL_MS,
    )
    const handleFocus = () => void syncLatestProject()
    window.addEventListener('focus', handleFocus)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [applyRemoteProject, isStandaloneProject, projectId, projectLoadState])

  useEffect(() => {
    if (
      projectLoadState !== 'ready' ||
      projectAccessRole === 'viewer' ||
      !projectId ||
      isStandaloneProject ||
      !recoveryUserId ||
      projectDocumentSignature === savedDocumentSignatureRef.current
    ) {
      return
    }

    saveCloudProjectRecovery(projectId, recoveryUserId, projectDocument)

    let isCancelled = false
    const timeoutId = window.setTimeout(async () => {
      if (versionActionInProgressRef.current) {
        return
      }

      // The polling loop may have merged a collaborator's changes while this
      // debounce timer was waiting. Always save the latest merged document,
      // rather than the document captured when the timer was scheduled.
      const documentToSave =
        currentProjectDocumentRef.current ?? projectDocument
      const documentSignatureToSave = JSON.stringify(documentToSave)

      setProjectSaveState('saving')
      setProjectSaveRequiresLogin(false)
      cloudRequestInProgressRef.current = true

      try {
        const updatedProject = await updateProject(projectId, {
          document: documentToSave,
          expectedUpdatedAt: savedProjectUpdatedAtRef.current ?? undefined,
        })

        savedProjectUpdatedAtRef.current = updatedProject.updatedAt
        savedProjectDocumentRef.current = updatedProject.document

        if (isCancelled) {
          return
        }

        setLoadedProject(updatedProject)
        savedDocumentSignatureRef.current = JSON.stringify(
          updatedProject.document,
        )
        if (savedDocumentSignatureRef.current !== documentSignatureToSave) {
          const selectedNodeIds = new Set(
            useCanvasStore
              .getState()
              .nodes.filter((node) => node.selected)
              .map((node) => node.id),
          )
          replaceProject(
            updatedProject.document.nodes.map((node) => ({
              ...node,
              selected: selectedNodeIds.has(node.id),
            })),
            updatedProject.document.edges,
          )
          replaceProjectMessages(
            updatedProject.document.messages,
            updatedProject.document.suggestionEvents,
            true,
          )
        }
        clearCloudProjectRecovery(projectId, recoveryUserId)
        if (saveRetryTimeoutRef.current !== null) {
          window.clearTimeout(saveRetryTimeoutRef.current)
          saveRetryTimeoutRef.current = null
        }
        setProjectSaveState('saved')
      } catch (error) {
        if (!isCancelled) {
          if (error instanceof ApiRequestError && error.status === 409) {
            try {
              const remoteProject = await getProject(projectId)
              applyRemoteProject(remoteProject, true)
              return
            } catch {
              // Keep the local recovery copy and let polling retry the merge.
            }
          }
          setProjectSaveState('error')
          setProjectSaveRequiresLogin(
            error instanceof ApiRequestError && error.status === 401,
          )
          if (
            !(error instanceof ApiRequestError && error.status === 401) &&
            saveRetryTimeoutRef.current === null
          ) {
            saveRetryTimeoutRef.current = window.setTimeout(() => {
              saveRetryTimeoutRef.current = null
              setSaveRetryRevision((revision) => revision + 1)
            }, LIVE_SYNC_INTERVAL_MS)
          }
        }
      } finally {
        cloudRequestInProgressRef.current = false
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
    isStandaloneProject,
    projectAccessRole,
    projectLoadState,
    recoveryUserId,
    saveRetryRevision,
    applyRemoteProject,
    replaceProject,
    replaceProjectMessages,
  ])

  async function duplicateCurrentProject() {
    if (
      !projectId ||
      isStandaloneProject ||
      !loadedProject ||
      projectAction !== 'idle'
    ) {
      return
    }

    setProjectAction('duplicating')
    setProjectActionError('')

    try {
      const copy = await createProject({
        name: getProjectCopyName(loadedProject.name),
        document: projectDocument,
      })
      setProjectAction('idle')
      void navigate(`/projects/${copy.id}`)
    } catch (error) {
      setProjectActionError(getProjectLoadErrorMessage(error))
      setProjectAction('idle')
    }
  }

  async function syncCurrentProjectForVersionAction(): Promise<Project> {
    if (!projectId || isStandaloneProject || !loadedProject) {
      throw new Error('目前專案無法建立版本')
    }

    if (projectDocumentSignature === savedDocumentSignatureRef.current) {
      return loadedProject
    }

    setProjectSaveState('saving')
    try {
      const updatedProject = await updateProject(projectId, {
        document: projectDocument,
        expectedUpdatedAt: savedProjectUpdatedAtRef.current ?? undefined,
      })
      savedProjectUpdatedAtRef.current = updatedProject.updatedAt
      savedProjectDocumentRef.current = updatedProject.document
      savedDocumentSignatureRef.current = JSON.stringify(
        updatedProject.document,
      )
      setLoadedProject(updatedProject)
      setProjectSaveState('saved')

      if (recoveryUserId) {
        clearCloudProjectRecovery(projectId, recoveryUserId)
      }

      return updatedProject
    } catch (error) {
      setProjectSaveState('error')
      throw error
    }
  }

  async function createCurrentProjectVersion(
    name: string,
  ): Promise<ProjectVersion> {
    if (!projectId || isStandaloneProject) {
      throw new Error('本機畫布不支援雲端版本紀錄')
    }

    versionActionInProgressRef.current = true

    try {
      await syncCurrentProjectForVersionAction()
      const version = await createProjectVersion(projectId, name)
      lastAutomaticVersionSignatureRef.current =
        savedDocumentSignatureRef.current
      return version
    } finally {
      versionActionInProgressRef.current = false
    }
  }

  async function restoreCurrentProjectVersion(versionId: string) {
    if (!projectId || isStandaloneProject) {
      throw new Error('本機畫布不支援雲端版本紀錄')
    }

    versionActionInProgressRef.current = true

    try {
      const currentProject = await syncCurrentProjectForVersionAction()
      const restoredProject = await restoreProjectVersion(
        projectId,
        versionId,
        currentProject.updatedAt,
      )
      replaceProject(
        restoredProject.document.nodes,
        restoredProject.document.edges,
      )
      replaceProjectMessages(
        restoredProject.document.messages,
        restoredProject.document.suggestionEvents,
      )
      setLoadedProject(restoredProject)
      setProjectAccessRole(restoredProject.accessRole)
      savedProjectUpdatedAtRef.current = restoredProject.updatedAt
      savedProjectDocumentRef.current = restoredProject.document
      savedDocumentSignatureRef.current = JSON.stringify(
        restoredProject.document,
      )
      lastAutomaticVersionSignatureRef.current =
        savedDocumentSignatureRef.current
      setPendingRecovery(null)
      setProjectSaveState('saved')

      if (recoveryUserId) {
        clearCloudProjectRecovery(projectId, recoveryUserId)
      }
    } finally {
      versionActionInProgressRef.current = false
    }
  }

  async function createPreImportVersion() {
    if (!projectId || isStandaloneProject) {
      return
    }

    versionActionInProgressRef.current = true

    try {
      await syncCurrentProjectForVersionAction()
      await createProjectVersion(projectId, '匯入前備份', 'pre_import')
      lastAutomaticVersionSignatureRef.current =
        savedDocumentSignatureRef.current
    } finally {
      versionActionInProgressRef.current = false
    }
  }

  async function moveCurrentProjectToTrash() {
    if (
      !projectId ||
      isStandaloneProject ||
      projectAccessRole !== 'owner' ||
      projectAction !== 'idle'
    ) {
      return
    }

    setProjectAction('deleting')
    setProjectActionError('')

    try {
      await deleteProject(projectId)
      if (recoveryUserId) {
        clearCloudProjectRecovery(projectId, recoveryUserId)
      }
      void navigate('/projects', { replace: true })
    } catch (error) {
      setProjectActionError(getProjectLoadErrorMessage(error))
      setProjectAction('idle')
    }
  }

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
        projectId={isExampleProject ? LOCAL_PROJECT_ID : projectId}
        aiSettingsRevision={aiSettingsRevision}
        currentUser={currentUser}
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
        <div className="flex min-h-0 flex-1">
          <Canvas
            isReadOnly={projectAccessRole === 'viewer'}
            autoStartTour={isExampleProject}
            canRenameProject={
              !isStandaloneProject && projectAccessRole !== 'viewer'
            }
            canManageProjectPermissions={
              !isStandaloneProject && projectAccessRole === 'owner'
            }
            canCopyProjectLink={!isStandaloneProject}
            canDuplicateProject={!isStandaloneProject}
            canDeleteProject={
              !isStandaloneProject && projectAccessRole === 'owner'
            }
            canViewProjectVersions={!isStandaloneProject}
            canExportResearchData={
              !isStandaloneProject && projectAccessRole === 'owner'
            }
            canManageAiSettings={!isStandaloneProject}
            onRenameProject={() => setActiveSettingsDialog('rename')}
            onManageProjectPermissions={() =>
              setActiveSettingsDialog('permissions')
            }
            onDuplicateProject={() => void duplicateCurrentProject()}
            onDeleteProject={() => void moveCurrentProjectToTrash()}
            onViewProjectVersions={() => setIsVersionsDialogOpen(true)}
            onExportResearchData={() => {
              if (projectId && loadedProject) {
                void downloadProjectResearchEvents(projectId, loadedProject.name)
              }
            }}
            onBeforeImportProject={createPreImportVersion}
            onManageAiSettings={() => setActiveSettingsDialog('ai')}
            projectAction={projectAction}
          />
        </div>
      </div>

      {(projectAction !== 'idle' || projectActionError) && (
        <div
          role={projectActionError ? 'alert' : 'status'}
          className="fixed bottom-4 left-1/2 z-50 flex min-h-11 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg"
        >
          <span>
            {projectActionError ||
              (projectAction === 'duplicating'
                ? '正在複製專案…'
                : '正在移到垃圾桶…')}
          </span>
          {projectActionError && (
            <button
              type="button"
              onClick={() => setProjectActionError('')}
              className="min-h-11 shrink-0 cursor-pointer rounded-lg px-3 font-medium transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              關閉
            </button>
          )}
        </div>
      )}

      {loadedProject && activeSettingsDialog && (
        <ProjectSettingsDialogs
          key={`${loadedProject.id}-${activeSettingsDialog}`}
          project={loadedProject}
          activeDialog={activeSettingsDialog}
          onClose={() => setActiveSettingsDialog(null)}
          onProjectUpdated={(project) => {
            setLoadedProject(project)
            setProjectAccessRole(project.accessRole)
            savedProjectUpdatedAtRef.current = project.updatedAt
          }}
          onAiCredentialUpdated={() =>
            setAiSettingsRevision((revision) => revision + 1)
          }
        />
      )}

      {loadedProject && isVersionsDialogOpen && (
        <ProjectVersionsDialog
          project={loadedProject}
          canEdit={projectAccessRole !== 'viewer'}
          onClose={() => setIsVersionsDialogOpen(false)}
          onCreateVersion={createCurrentProjectVersion}
          onRestoreVersion={restoreCurrentProjectVersion}
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

      {!isStandaloneProject && projectSaveState !== 'idle' && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur-sm ${
            projectSaveState === 'error'
              ? 'border-red-300 text-red-600'
              : 'pointer-events-none border-border text-muted-foreground'
          }`}
        >
          {projectSaveState === 'saving' && '儲存中…'}
          {projectSaveState === 'merging' && '正在合併其他使用者的更新…'}
          {projectSaveState === 'saved' && '已同步'}
          {projectSaveState === 'error' &&
            (projectSaveRequiresLogin
              ? '登入已過期，尚未儲存'
              : '同步暫時失敗，將自動重試')}
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
