import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDocument } from '../types/project'
import {
  clearCloudProjectRecovery,
  getCloudProjectRecovery,
  saveCloudProjectRecovery,
} from './cloudProjectRecovery'

const document: ProjectDocument = {
  version: 4,
  nodes: [],
  edges: [],
  messages: [],
  suggestionEvents: [],
}

describe('cloud project recovery', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('separates recovery copies by account and project', () => {
    expect(saveCloudProjectRecovery('project-1', 'user-1', document)).toBe(true)

    expect(getCloudProjectRecovery('project-1', 'user-1')?.document).toEqual(
      document,
    )
    expect(getCloudProjectRecovery('project-1', 'user-2')).toBeNull()
    expect(getCloudProjectRecovery('project-2', 'user-1')).toBeNull()
  })

  it('clears only the matching cloud recovery copy', () => {
    saveCloudProjectRecovery('project-1', 'user-1', document)
    saveCloudProjectRecovery('project-2', 'user-1', document)

    clearCloudProjectRecovery('project-1', 'user-1')

    expect(getCloudProjectRecovery('project-1', 'user-1')).toBeNull()
    expect(getCloudProjectRecovery('project-2', 'user-1')).not.toBeNull()
  })
})
