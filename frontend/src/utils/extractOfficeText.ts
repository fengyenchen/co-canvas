import JSZip from 'jszip'

function xmlText(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(document.querySelectorAll('t'))
    .map((node) => node.textContent ?? '')
    .filter(Boolean)
    .join(' ')
}

async function extractDocx(zip: JSZip) {
  const xml = await zip.file('word/document.xml')?.async('text')
  if (!xml) throw new Error('DOCX 缺少文件內容')
  return xmlText(xml)
}

async function extractPptx(zip: JSZip, pageRange?: { startPage: number; endPage: number }) {
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
  const selectedSlides = pageRange
    ? slides.slice(pageRange.startPage - 1, pageRange.endPage)
    : slides
  const contents = await Promise.all(selectedSlides.map(async (name, index) => {
    const xml = await zip.file(name)?.async('text')
    const slideNumber = pageRange ? pageRange.startPage + index : index + 1
    return `投影片 ${slideNumber}\n${xml ? xmlText(xml) : ''}`
  }))
  return contents.join('\n\n')
}

async function extractXlsx(zip: JSZip) {
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('text')
  const shared = sharedXml
    ? Array.from(new DOMParser().parseFromString(sharedXml, 'application/xml').querySelectorAll('si'))
        .map((node) => Array.from(node.querySelectorAll('t')).map((part) => part.textContent ?? '').join(''))
    : []
  const sheets = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
  const output: string[] = []
  for (let index = 0; index < sheets.length; index += 1) {
    const xml = await zip.file(sheets[index])?.async('text')
    if (!xml) continue
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    const rows = Array.from(document.querySelectorAll('row')).map((row) =>
      Array.from(row.querySelectorAll('c')).map((cell) => {
        const value = cell.querySelector('v')?.textContent ?? ''
        return cell.getAttribute('t') === 's' ? shared[Number(value)] ?? '' : value
      }).join('\t'),
    )
    output.push(`工作表 ${index + 1}\n${rows.join('\n')}`)
  }
  return output.join('\n\n')
}

export async function prepareFileForAi(
  file: File,
  pageRange?: { startPage: number; endPage: number },
) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!['docx', 'xlsx', 'pptx'].includes(extension ?? '')) return file
  const zip = await JSZip.loadAsync(file)
  const text = extension === 'docx'
    ? await extractDocx(zip)
    : extension === 'xlsx'
      ? await extractXlsx(zip)
      : await extractPptx(zip, pageRange)
  if (!text.trim()) throw new Error('這個 Office 檔案沒有可抽取的文字內容')
  return new File([text], `${file.name}.txt`, { type: 'text/plain' })
}
