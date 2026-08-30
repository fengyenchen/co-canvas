export type LocalNodeFile = {
  file: File
  fileName: string
  mimeType: string
  size: number
  url: string
  geminiUploads: Map<string, string>
}

type FileMetadata = {
  fileName: string
  mimeType: string
  size: number
  lastModified: number
}

const DIRECTORY_NAME = 'co-canvas-local-files'
const localFiles = new Map<string, LocalNodeFile>()

export const LOCAL_NODE_FILE_CHANGED_EVENT = 'co-canvas-local-node-file-changed'

function notify(nodeId: string) {
  window.dispatchEvent(new CustomEvent(LOCAL_NODE_FILE_CHANGED_EVENT, { detail: { nodeId } }))
}

function release(entry: LocalNodeFile | undefined) {
  if (entry) URL.revokeObjectURL(entry.url)
}

async function getDirectory() {
  if (!navigator.storage?.getDirectory) return null
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(DIRECTORY_NAME, { create: true })
}

async function writeFile(handle: FileSystemFileHandle, value: Blob | string) {
  const writable = await handle.createWritable()
  await writable.write(value)
  await writable.close()
}

export function getLocalNodeFile(nodeId: string) {
  return localFiles.get(nodeId)
}

export function getLocalNodeGeminiFile(nodeId: string, scope: string) {
  return localFiles.get(nodeId)?.geminiUploads.get(scope)
}

export function setLocalNodeGeminiFile(nodeId: string, scope: string, fileName: string) {
  localFiles.get(nodeId)?.geminiUploads.set(scope, fileName)
}

export function setLocalNodeFile(nodeId: string, file: File) {
  release(localFiles.get(nodeId))
  const entry: LocalNodeFile = {
    file,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    url: URL.createObjectURL(file),
    geminiUploads: new Map(),
  }
  localFiles.set(nodeId, entry)
  notify(nodeId)
  return entry
}

export async function persistLocalNodeFile(nodeId: string, file: File) {
  const directory = await getDirectory()
  if (!directory) return false
  const fileHandle = await directory.getFileHandle(`${nodeId}.bin`, { create: true })
  const metadataHandle = await directory.getFileHandle(`${nodeId}.json`, { create: true })
  const metadata: FileMetadata = {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    lastModified: file.lastModified,
  }
  await writeFile(fileHandle, file)
  await writeFile(metadataHandle, JSON.stringify(metadata))
  return true
}

export async function restoreLocalNodeFile(nodeId: string) {
  const existing = localFiles.get(nodeId)
  if (existing) return existing
  const directory = await getDirectory()
  if (!directory) return undefined
  try {
    const metadataFile = await (await directory.getFileHandle(`${nodeId}.json`)).getFile()
    const metadata = JSON.parse(await metadataFile.text()) as FileMetadata
    const storedFile = await (await directory.getFileHandle(`${nodeId}.bin`)).getFile()
    if (storedFile.size !== metadata.size) return undefined
    const file = new File([storedFile], metadata.fileName, {
      type: metadata.mimeType,
      lastModified: metadata.lastModified,
    })
    return setLocalNodeFile(nodeId, file)
  } catch {
    return undefined
  }
}

export async function clearLocalNodeFile(nodeId: string) {
  release(localFiles.get(nodeId))
  localFiles.delete(nodeId)
  const directory = await getDirectory()
  if (directory) {
    await Promise.allSettled([
      directory.removeEntry(`${nodeId}.bin`),
      directory.removeEntry(`${nodeId}.json`),
    ])
  }
  notify(nodeId)
}

export function releaseLocalNodeFileUrls() {
  for (const entry of localFiles.values()) release(entry)
  localFiles.clear()
}

export function pruneLocalNodeFiles(activeNodeIds: Set<string>) {
  for (const nodeId of localFiles.keys()) {
    if (!activeNodeIds.has(nodeId)) void clearLocalNodeFile(nodeId)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', releaseLocalNodeFileUrls)
}
