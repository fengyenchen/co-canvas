import JSZip from 'jszip'

export type DocumentPageInfo = {
  pageCount: number
  pageUnit: 'page' | 'slide'
}

export async function readDocumentPageInfo(file: File): Promise<DocumentPageInfo | null> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'pptx') {
    const zip = await JSZip.loadAsync(file)
    const pageCount = Object.keys(zip.files).filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name),
    ).length
    return pageCount > 0 ? { pageCount, pageUnit: 'slide' } : null
  }

  if (extension === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    const bytes = new Uint8Array(await file.arrayBuffer())
    const loadingTask = pdfjs.getDocument({ data: bytes })
    const document = await loadingTask.promise
    const pageCount = document.numPages
    await loadingTask.destroy()
    return pageCount > 0 ? { pageCount, pageUnit: 'page' } : null
  }

  return null
}
