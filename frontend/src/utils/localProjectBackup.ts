import { useCanvasStore } from '../stores/canvasStore'
import { useChatStore } from '../stores/chatStore'
import { createProjectFile, parseProjectFile } from './projectFile'

export const LOCAL_PROJECT_ID = 'local'

const ACTIVE_PROJECT_KEY = 'co-canvas-active-project'
const LOCAL_PROJECT_BACKUP_KEY = 'co-canvas-local-project-backup'

export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_PROJECT_KEY)
}

export function setActiveProjectId(projectId: string): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, projectId)
}

export function backupLocalProject(): boolean {
  try {
    const { nodes, edges } = useCanvasStore.getState()
    const { messages } = useChatStore.getState()
    const project = createProjectFile(nodes, edges, messages)

    localStorage.setItem(
      LOCAL_PROJECT_BACKUP_KEY,
      JSON.stringify(project),
    )
    return true
  } catch {
    return false
  }
}

export function restoreLocalProject(): boolean {
  try {
    const rawProject = localStorage.getItem(LOCAL_PROJECT_BACKUP_KEY)

    if (!rawProject) {
      return false
    }

    const project = parseProjectFile(JSON.parse(rawProject))

    useCanvasStore
      .getState()
      .replaceProject(project.nodes, project.edges)
    useChatStore
      .getState()
      .replaceProjectMessages(project.messages)
    return true
  } catch {
    return false
  }
}
