import type { ProjectDocument } from '../types/project'
import { projectDocumentSchema } from './projectFile'

const CLOUD_PROJECT_RECOVERY_PREFIX = 'co-canvas-cloud-recovery'

export type CloudProjectRecovery = {
  version: 1
  projectId: string
  userId: string
  savedAt: string
  document: ProjectDocument
}

function createRecoveryKey(projectId: string, userId: string): string {
  return `${CLOUD_PROJECT_RECOVERY_PREFIX}:${userId}:${projectId}`
}

export function saveCloudProjectRecovery(
  projectId: string,
  userId: string,
  document: ProjectDocument,
): boolean {
  try {
    const recovery: CloudProjectRecovery = {
      version: 1,
      projectId,
      userId,
      savedAt: new Date().toISOString(),
      document,
    }

    localStorage.setItem(
      createRecoveryKey(projectId, userId),
      JSON.stringify(recovery),
    )
    return true
  } catch {
    return false
  }
}

export function getCloudProjectRecovery(
  projectId: string,
  userId: string,
): CloudProjectRecovery | null {
  try {
    const rawRecovery = localStorage.getItem(
      createRecoveryKey(projectId, userId),
    )
    if (!rawRecovery) return null

    const candidate = JSON.parse(rawRecovery) as Partial<CloudProjectRecovery>
    const document = projectDocumentSchema.safeParse(candidate.document)

    if (
      candidate.version !== 1 ||
      candidate.projectId !== projectId ||
      candidate.userId !== userId ||
      typeof candidate.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(candidate.savedAt)) ||
      !document.success
    ) {
      return null
    }

    return {
      version: 1,
      projectId,
      userId,
      savedAt: candidate.savedAt,
      document: document.data,
    }
  } catch {
    return null
  }
}

export function clearCloudProjectRecovery(
  projectId: string,
  userId: string,
): void {
  try {
    localStorage.removeItem(createRecoveryKey(projectId, userId))
  } catch {
    // localStorage unavailable; the recovery copy can safely expire in place.
  }
}
