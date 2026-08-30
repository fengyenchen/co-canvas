export type LocalVideoFile = {
  file: File
  fileName: string
  mimeType: string
  size: number
  url: string
  geminiUploads: Map<string, string>
}

type LocalVideoMetadata = {
  fileName: string
  mimeType: string
  lastModified: number
  size: number
}

const localVideoFiles = new Map<string, LocalVideoFile>()
const LOCAL_VIDEO_DIRECTORY = 'co-canvas-local-videos'
export const LOCAL_VIDEO_CHANGED_EVENT = 'co-canvas-local-video-changed'

function notifyLocalVideoChanged(nodeId: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LOCAL_VIDEO_CHANGED_EVENT, {
    detail: { nodeId },
  }))
}

function getStorageFileName(nodeId: string, suffix: 'video' | 'json'): string {
  return `${encodeURIComponent(nodeId)}.${suffix}`
}

async function getLocalVideoDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) {
    throw new Error('目前瀏覽器不支援保存本機影片')
  }

  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(LOCAL_VIDEO_DIRECTORY, { create: true })
}

function releaseLocalVideoMemory(nodeId: string): void {
  const localVideo = localVideoFiles.get(nodeId)
  if (!localVideo) return

  URL.revokeObjectURL(localVideo.url)
  localVideoFiles.delete(nodeId)
}

export function getLocalVideoFile(nodeId: string): LocalVideoFile | null {
  return localVideoFiles.get(nodeId) ?? null
}

export function setLocalVideoFile(
  nodeId: string,
  file: File,
): LocalVideoFile {
  releaseLocalVideoMemory(nodeId)

  const localVideo = {
    file,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
    url: URL.createObjectURL(file),
    geminiUploads: new Map<string, string>(),
  }
  localVideoFiles.set(nodeId, localVideo)
  notifyLocalVideoChanged(nodeId)
  return localVideo
}

export async function persistLocalVideoFile(
  nodeId: string,
  file: File,
): Promise<void> {
  const directory = await getLocalVideoDirectory()
  const videoHandle = await directory.getFileHandle(
    getStorageFileName(nodeId, 'video'),
    { create: true },
  )
  const videoWriter = await videoHandle.createWritable()
  await videoWriter.write(file)
  await videoWriter.close()

  const metadata: LocalVideoMetadata = {
    fileName: file.name,
    mimeType: file.type,
    lastModified: file.lastModified,
    size: file.size,
  }
  const metadataHandle = await directory.getFileHandle(
    getStorageFileName(nodeId, 'json'),
    { create: true },
  )
  const metadataWriter = await metadataHandle.createWritable()
  await metadataWriter.write(JSON.stringify(metadata))
  await metadataWriter.close()

  await navigator.storage.persist?.()
}

export async function restoreLocalVideoFile(
  nodeId: string,
): Promise<LocalVideoFile | null> {
  const existing = getLocalVideoFile(nodeId)
  if (existing) return existing

  try {
    const directory = await getLocalVideoDirectory()
    const metadataHandle = await directory.getFileHandle(
      getStorageFileName(nodeId, 'json'),
    )
    const storedVideoHandle = await directory.getFileHandle(
      getStorageFileName(nodeId, 'video'),
    )
    const metadataFile = await metadataHandle.getFile()
    const metadata = JSON.parse(
      await metadataFile.text(),
    ) as LocalVideoMetadata
    const storedVideo = await storedVideoHandle.getFile()

    if (
      !metadata.fileName ||
      !metadata.mimeType ||
      metadata.size !== storedVideo.size
    ) {
      return null
    }

    const restoredFile = new File([storedVideo], metadata.fileName, {
      type: metadata.mimeType,
      lastModified: metadata.lastModified,
    })
    return setLocalVideoFile(nodeId, restoredFile)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return null
    }
    throw error
  }
}

export function getLocalVideoGeminiFile(
  nodeId: string,
  scope: string,
): string | null {
  return localVideoFiles.get(nodeId)?.geminiUploads.get(scope) ?? null
}

export function setLocalVideoGeminiFile(
  nodeId: string,
  scope: string,
  fileName: string,
): void {
  localVideoFiles.get(nodeId)?.geminiUploads.set(scope, fileName)
}

export function clearLocalVideoFile(nodeId: string): void {
  releaseLocalVideoMemory(nodeId)
  notifyLocalVideoChanged(nodeId)
  void getLocalVideoDirectory()
    .then(async (directory) => {
      await Promise.all([
        directory.removeEntry(getStorageFileName(nodeId, 'video')).catch(() => {}),
        directory.removeEntry(getStorageFileName(nodeId, 'json')).catch(() => {}),
      ])
    })
    .catch(() => {})
}

export function pruneLocalVideoFiles(activeNodeIds: Set<string>): void {
  for (const nodeId of localVideoFiles.keys()) {
    if (!activeNodeIds.has(nodeId)) clearLocalVideoFile(nodeId)
  }
}

export function clearAllLocalVideoFiles(): void {
  for (const nodeId of [...localVideoFiles.keys()]) {
    releaseLocalVideoMemory(nodeId)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', clearAllLocalVideoFiles)
}
