import { AudioLines, Download, FileText, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import type { AudioCanvasNode, CanvasNode, DocumentCanvasNode, ImageCanvasNode } from '../../types/canvas'
import { readDocumentPageInfo } from '../../utils/documentPages'
import {
  clearLocalNodeFile,
  getLocalNodeFile,
  LOCAL_NODE_FILE_CHANGED_EVENT,
  persistLocalNodeFile,
  pruneLocalNodeFiles,
  restoreLocalNodeFile,
  setLocalNodeFile,
  type LocalNodeFile,
} from '../../utils/localNodeFiles'

type FilePanelProps = { isReadOnly?: boolean }

const documentExtensions = new Set(['pdf', 'txt', 'md', 'markdown', 'csv', 'json', 'html', 'css', 'xml', 'rtf', 'js', 'docx', 'xlsx', 'pptx'])
const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif', 'bmp'])
const audioExtensions = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'])
const MAX_FILE_SIZE = 100 * 1024 * 1024

const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
  csv: 'text/csv', json: 'application/json', html: 'text/html', css: 'text/css',
  xml: 'text/xml', rtf: 'text/rtf', js: 'text/javascript',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', flac: 'audio/flac',
}

type AttachmentNode = DocumentCanvasNode | ImageCanvasNode | AudioCanvasNode

function isFileNode(node: CanvasNode): node is AttachmentNode {
  return node.type === 'document' || node.type === 'image' || node.type === 'audio'
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File, nodeType: AttachmentNode['type']) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const isAllowed = nodeType === 'image'
    ? imageExtensions.has(extension)
    : nodeType === 'audio'
      ? audioExtensions.has(extension)
      : documentExtensions.has(extension)
  if (!isAllowed) {
    return nodeType === 'image'
      ? '圖片節點支援 PNG、JPG、WebP、HEIC、HEIF 與 BMP。'
      : nodeType === 'audio'
        ? '音訊節點支援 MP3、WAV、M4A、AAC、OGG 與 FLAC。'
        : '文件／資料支援 PDF、文字資料、DOCX、XLSX 與 PPTX。'
  }
  if (!file.size) return '這個檔案沒有內容。'
  if (extension === 'pdf' && file.size > 50 * 1024 * 1024) return 'PDF 目前上限為 50 MB。'
  if (file.size > MAX_FILE_SIZE) return '單一檔案目前上限為 100 MB。'
  return null
}

function FilePreview({ entry, title, onAudioDuration }: { entry: LocalNodeFile; title: string; onAudioDuration?: (durationMs: number) => void }) {
  const [text, setText] = useState('')
  const mimeType = entry.mimeType
  const extension = entry.fileName.split('.').pop()?.toLowerCase()
  const isText = mimeType.startsWith('text/') || ['md', 'markdown', 'csv', 'json'].includes(extension ?? '')

  useEffect(() => {
    if (!isText) return
    let cancelled = false
    entry.file.slice(0, 200_000).text().then((value) => {
      if (!cancelled) setText(value)
    })
    return () => { cancelled = true }
  }, [entry.file, isText])

  if (mimeType.startsWith('image/')) {
    return <img src={entry.url} alt={`${title} 預覽`} className="max-h-80 w-full rounded-lg border border-border object-contain" />
  }
  if (mimeType.startsWith('audio/') || audioExtensions.has(extension ?? '')) {
    return (
      <audio
        controls
        preload="metadata"
        src={entry.url}
        aria-label={`${title} 音訊播放器`}
        onLoadedMetadata={(event) => {
          const durationMs = Math.round(event.currentTarget.duration * 1000)
          if (Number.isFinite(durationMs) && durationMs > 0) onAudioDuration?.(durationMs)
        }}
        className="w-full"
      >
        你的瀏覽器不支援音訊播放。
      </audio>
    )
  }
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return <iframe src={entry.url} title={`${title} PDF 預覽`} className="h-96 w-full rounded-lg border border-border bg-white" />
  }
  if (isText) {
    return <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-control-hover p-3 text-xs text-foreground">{text}</pre>
  }
  return (
    <div className="rounded-lg border border-border bg-control-hover p-4 text-sm text-foreground/65">
      Office 檔案會在對話時抽取文字供 AI 分析；瀏覽器不提供原版面預覽。
    </div>
  )
}

function FileNodeEditor({ node, isReadOnly }: { node: AttachmentNode; isReadOnly: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [entry, setEntry] = useState(() => getLocalNodeFile(node.id))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [sourceDraft, setSourceDraft] = useState(node.data.source ?? '')
  const updateFileNode = useCanvasStore((state) => state.updateDocumentNode)
  const deleteNode = useCanvasStore((state) => state.deleteNode)
  const deleteBranch = useCanvasStore((state) => state.deleteBranch)
  const setActiveContextNodeId = useChatStore((state) => state.setActiveContextNodeId)
  const isSourceApplied = sourceDraft.trim() === (node.data.source ?? '')

  useEffect(() => {
    let cancelled = false
    restoreLocalNodeFile(node.id).then(async (restored) => {
      if (!cancelled) setEntry(restored)
      if (
        !cancelled &&
        restored &&
        node.type === 'document' &&
        node.data.pageCount === undefined
      ) {
        try {
          const pageInfo = await readDocumentPageInfo(restored.file)
          if (!cancelled && pageInfo) updateFileNode(node.id, pageInfo)
        } catch {
          // The file remains usable even when page metadata cannot be read.
        }
      }
    })
    const onChange = (event: Event) => {
      if ((event as CustomEvent<{ nodeId: string }>).detail?.nodeId === node.id) {
        setEntry(getLocalNodeFile(node.id))
      }
    }
    window.addEventListener(LOCAL_NODE_FILE_CHANGED_EVENT, onChange)
    return () => {
      cancelled = true
      window.removeEventListener(LOCAL_NODE_FILE_CHANGED_EVENT, onChange)
    }
  }, [node.data.pageCount, node.id, node.type, updateFileNode])

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const message = validateFile(file, node.type)
    if (message) { setError(message); return }
    setError('')
    setIsSaving(true)
    let pageInfo = null
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    try {
      pageInfo = node.type === 'document' ? await readDocumentPageInfo(file) : null
    } catch {
      setError('檔案可以使用，但無法讀取頁數；仍可分析完整文件。')
    }
    const nextEntry = setLocalNodeFile(node.id, file)
    setEntry(nextEntry)
    updateFileNode(node.id, {
      title: /^新(文件|圖片|音訊) \d+$/.test(node.data.title) ? file.name.replace(/\.[^.]+$/, '') : node.data.title,
      fileName: file.name,
      mimeType: file.type || mimeByExtension[extension] || 'application/octet-stream',
      size: file.size,
      source: undefined,
      pageCount: pageInfo?.pageCount,
      pageUnit: pageInfo?.pageUnit,
      durationMs: undefined,
    })
    try {
      await persistLocalNodeFile(node.id, file)
    } catch {
      setError('檔案可在本頁使用，但瀏覽器無法保存；重新整理後需要重新選擇。')
    } finally {
      setIsSaving(false)
    }
  }

  async function removeFile() {
    await clearLocalNodeFile(node.id)
    setEntry(undefined)
    updateFileNode(node.id, { fileName: undefined, mimeType: undefined, size: undefined, pageCount: undefined, pageUnit: undefined, durationMs: undefined })
  }

  async function applySource() {
    const value = sourceDraft.trim()
    if (!value) { updateFileNode(node.id, { source: undefined }); return }
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:') throw new Error()
      const extension = url.pathname.split('.').pop()?.toLowerCase() ?? ''
      const allowed = node.type === 'image'
        ? imageExtensions
        : node.type === 'audio'
          ? audioExtensions
          : documentExtensions
      if (!allowed.has(extension)) {
        setError(
          node.type === 'image'
            ? '請使用可直接開啟的圖片網址。'
            : node.type === 'audio'
              ? '請使用網址末尾含副檔名的公開音訊直連。'
              : '請使用網址末尾含副檔名的文件直連。',
        )
        return
      }
    } catch {
      setError('請輸入完整的公開 HTTPS 原檔直連網址。')
      return
    }
    await clearLocalNodeFile(node.id)
    setEntry(undefined)
    setError('')
    const fileName = value.split('/').pop()?.split('?')[0]
    const extension = fileName?.split('.').pop()?.toLowerCase() ?? ''
    updateFileNode(node.id, {
      source: value,
      fileName,
      mimeType: mimeByExtension[extension],
      size: undefined,
      pageCount: undefined,
      pageUnit: extension === 'pdf' ? 'page' : extension === 'pptx' ? 'slide' : undefined,
      durationMs: undefined,
    })
  }

  async function removeNode(branch: boolean) {
    await clearLocalNodeFile(node.id)
    if (branch) deleteBranch(node.id)
    else deleteNode(node.id)
    setActiveContextNodeId(null)
  }

  return (
    <aside className="absolute inset-y-4 right-4 z-20 w-[min(28rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-lg">
      <div className="mb-5 flex items-center gap-2 font-semibold">
        {node.type === 'audio' ? <AudioLines className="size-5" aria-hidden="true" /> : <FileText className="size-5" aria-hidden="true" />}
        {node.type === 'image' ? '圖片節點' : node.type === 'audio' ? '音訊節點' : '文件／資料'}
      </div>
      <label className="mb-2 block text-sm text-foreground/70" htmlFor={`file-title-${node.id}`}>標題</label>
      <input id={`file-title-${node.id}`} value={node.data.title} readOnly={isReadOnly} onChange={(event) => updateFileNode(node.id, { title: event.target.value })} className="mb-4 min-h-11 w-full rounded-lg border border-border bg-background px-3" />
      <label className="mb-2 block text-sm text-foreground/70" htmlFor={`file-content-${node.id}`}>內容</label>
      <textarea id={`file-content-${node.id}`} value={node.data.content} readOnly={isReadOnly} onChange={(event) => updateFileNode(node.id, { content: event.target.value })} className="mb-5 min-h-28 w-full resize-y rounded-lg border border-border bg-background p-3" />

      {!isReadOnly && (
        <>
          <input ref={inputRef} type="file" className="sr-only" accept={node.type === 'image' ? '.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp' : node.type === 'audio' ? '.mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*' : '.pdf,.txt,.md,.markdown,.csv,.json,.html,.css,.xml,.rtf,.js,.docx,.xlsx,.pptx'} onChange={handleFile} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={isSaving} className="mb-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50">
            <Upload className="size-4" aria-hidden="true" />{entry ? '更換本機檔案' : '選擇本機檔案'}
          </button>
        </>
      )}

      {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {entry ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-control-hover p-3 text-sm">
            <span className="min-w-0 truncate">{entry.fileName} · {formatSize(entry.size)}</span>
            <div className="flex shrink-0 gap-2">
              <a href={entry.url} download={entry.fileName} aria-label={`下載 ${entry.fileName}`} className="flex size-11 items-center justify-center rounded-lg hover:bg-background"><Download className="size-4" aria-hidden="true" /></a>
              {!isReadOnly && <button type="button" onClick={removeFile} className="min-h-11 cursor-pointer rounded-md px-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200">移除</button>}
            </div>
          </div>
          <FilePreview
            entry={entry}
            title={node.data.title}
            onAudioDuration={
              node.type === 'audio'
                ? (durationMs) => {
                    if (durationMs !== node.data.durationMs) {
                      updateFileNode(node.id, { durationMs })
                    }
                  }
                : undefined
            }
          />
          {node.data.pageCount && (
            <p className="text-sm text-foreground/65">
              {node.data.pageUnit === 'slide' ? '投影片數' : '頁數'}：{node.data.pageCount}
            </p>
          )}
          <p className="text-xs leading-5 text-foreground/55">原檔保存在這台瀏覽器，不會寫入雲端專案；進入對話時才會暫時傳給 Gemini。</p>
        </div>
      ) : node.data.fileName && !node.data.source ? (
        <p className="rounded-lg border border-border p-3 text-sm text-foreground/60">此專案記錄了 {node.data.fileName}，但這台瀏覽器沒有原檔，請重新選擇相同檔案。</p>
      ) : null}

      {!entry && (
        <div className="mt-5 border-t border-border pt-5">
          <label className="mb-2 block text-sm text-foreground/70" htmlFor={`file-url-${node.id}`}>{node.type === 'image' ? '圖片網址' : node.type === 'audio' ? '音訊網址' : '文件網址'}</label>
          <input
            id={`file-url-${node.id}`}
            type="url"
            value={sourceDraft}
            readOnly={isReadOnly}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setSourceDraft(event.target.value)
              setError('')
            }}
            placeholder={node.type === 'image' ? 'https://example.com/image.jpg' : node.type === 'audio' ? 'https://example.com/audio.mp3' : 'https://example.com/document.pdf'}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {!isReadOnly && (
            <button
              type="button"
              onClick={applySource}
              disabled={isSourceApplied}
              className="mt-3 min-h-11 w-full cursor-pointer rounded-lg bg-primary px-4 text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              套用網址
            </button>
          )}
          {node.data.source && node.type === 'image' && <img src={node.data.source} alt={`${node.data.title} 預覽`} className="mt-3 max-h-80 w-full rounded-lg border border-border object-contain" />}
          {node.data.source && node.type === 'audio' && (
            <audio
              controls
              preload="metadata"
              src={node.data.source}
              aria-label={`${node.data.title} 音訊播放器`}
              onLoadedMetadata={(event) => {
                const durationMs = Math.round(event.currentTarget.duration * 1000)
                if (Number.isFinite(durationMs) && durationMs > 0 && durationMs !== node.data.durationMs) {
                  updateFileNode(node.id, { durationMs })
                }
              }}
              className="mt-3 w-full"
            >
              你的瀏覽器不支援音訊播放。
            </audio>
          )}
          {node.data.source?.toLowerCase().split('?')[0].endsWith('.pdf') && <iframe src={node.data.source} title={`${node.data.title} PDF 預覽`} className="mt-3 h-96 w-full rounded-lg border border-border bg-white" />}
        </div>
      )}

      {!isReadOnly && (
        <div className="mt-6 space-y-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={() => removeNode(false)}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-border px-4 py-2 text-sm text-foreground transition hover:border-red-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
          >
            只刪除此節點
          </button>
          <button
            type="button"
            onClick={() => removeNode(true)}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
          >
            刪除此分支
          </button>
        </div>
      )}
    </aside>
  )
}

export function FilePanel({ isReadOnly = false }: FilePanelProps) {
  const nodes = useCanvasStore((state) => state.nodes)
  const selected = useCanvasStore((state) => state.nodes.find((node) => node.selected && isFileNode(node)) as AttachmentNode | undefined)
  useEffect(() => {
    pruneLocalNodeFiles(new Set(nodes.filter(isFileNode).map((node) => node.id)))
  }, [nodes])
  if (!selected) return null
  return <FileNodeEditor key={selected.id} node={selected} isReadOnly={isReadOnly} />
}
