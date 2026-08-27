import { useEffect, type ReactNode } from 'react'
import { ArrowLeft, BookOpen, FileSpreadsheet, FolderKanban } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import coCanvasMark from '../../assets/branding/co-canvas-mark-primary.svg'

type GuideLayoutProps = {
  children: ReactNode
  documentTitle: string
  headerTo: string
  headerTitle: string
  sections: ReadonlyArray<readonly [string, string]>
  returnLabel?: string
  returnTo?: string
  showResearchGuideLink?: boolean
}

export function GuideLayout({ children, documentTitle, headerTo, headerTitle, sections, returnLabel = '返回首頁', returnTo = '/', showResearchGuideLink = false }: GuideLayoutProps) {
  const { hash } = useLocation()

  useEffect(() => {
    const previousTitle = document.title
    document.title = documentTitle
    return () => { document.title = previousTitle }
  }, [documentTitle])

  useEffect(() => {
    if (!hash) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [hash])

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to={headerTo} aria-label={`返回${headerTitle}頂端`} className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg pr-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <img src={coCanvasMark} alt="" className="size-9 shrink-0" />
            <span className="truncate">{headerTitle}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link to={returnTo} className="hidden min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:inline-flex">
              <ArrowLeft aria-hidden="true" className="size-4" />
              {returnLabel}
            </Link>
            <Link to="/projects" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <FolderKanban aria-hidden="true" className="size-4" />
              進入專案
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8 lg:py-7.5">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-background p-4 shadow-sm lg:flex lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col">
            <div className="flex shrink-0 items-center gap-2 px-2 pb-3 text-sm font-semibold"><BookOpen aria-hidden="true" className="size-4" />章節目錄</div>
            <nav aria-label="使用手冊章節" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:min-h-0 lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
              {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm text-foreground/65 transition hover:bg-control-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">{label}</a>)}
            </nav>
            {showResearchGuideLink && (
              <div className="mt-3 shrink-0 border-t border-border pt-3">
                <Link to="/guide/research" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground transition hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-primary" />研究資料指南
                </Link>
              </div>
            )}
          </div>
        </aside>
        <article className="min-w-0 rounded-2xl border border-border bg-background px-5 py-8 shadow-sm sm:px-8 lg:px-12 lg:py-12">{children}</article>
      </main>
    </div>
  )
}
