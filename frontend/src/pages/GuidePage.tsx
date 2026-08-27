import { useEffect, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import type { MDXComponents } from 'mdx/types'
import { ArrowLeft, BookOpen, FolderKanban } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'
import GuideContent from './guide/GuideContent.mdx'
import ResearchGuideContent from './guide/ResearchGuideContent.mdx'

const sections = [
  ['quick-start', '快速開始'],
  ['project-modes', '本機與雲端專案'],
  ['canvas-basics', '畫布基本操作'],
  ['nodes-edges', '節點與連線'],
  ['groups', '群組整理'],
  ['ai-chat', 'AI 對話與建議'],
  ['video', '影片節點與分析'],
  ['cloud', '雲端協作與權限'],
  ['versions', '版本、備份與復原'],
  ['shortcuts', '快捷鍵'],
  ['troubleshooting', '常見問題'],
] as const

const researchSections = [
  ['research-export', '匯出方式'],
  ['csv-fields', 'CSV 欄位字典'],
  ['analysis-workflow', '研究處理流程'],
  ['derived-metrics', '常用衍生指標'],
  ['analysis-tools', '分析工具範例'],
  ['research-limits', '限制與研究倫理'],
] as const

function GuideHero({ children }: { children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-canvas/65 px-6 py-8 shadow-sm sm:px-9 sm:py-10">
      <div aria-hidden="true" className="absolute -right-16 -top-20 size-52 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">{children}</div>
    </div>
  )
}

function SectionTitle({ id, children }: { id?: string; children?: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-16 scroll-mt-24 border-t border-border pt-12 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
    >
      {children}
    </h2>
  )
}

const mdxComponents: MDXComponents = {
  GuideHero,
  SectionTitle,
  h1: (props: ComponentPropsWithoutRef<'h1'>) => (
    <h1 {...props} className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.12] tracking-tight text-foreground sm:text-5xl lg:text-6xl" />
  ),
  h2: (props: ComponentPropsWithoutRef<'h2'>) => (
    <h2 {...props} className="mt-16 scroll-mt-24 border-t border-border pt-12 text-2xl font-semibold tracking-tight text-foreground first:mt-0 first:border-t-0 first:pt-0 sm:text-3xl" />
  ),
  h3: (props: ComponentPropsWithoutRef<'h3'>) => (
    <h3 {...props} className="mt-9 text-lg font-semibold text-foreground" />
  ),
  h4: (props: ComponentPropsWithoutRef<'h4'>) => (
    <h4 {...props} className="mt-6 font-semibold text-foreground" />
  ),
  p: (props: ComponentPropsWithoutRef<'p'>) => (
    <p {...props} className="mt-4 text-[0.95rem] leading-7 text-foreground/70" />
  ),
  ul: (props: ComponentPropsWithoutRef<'ul'>) => (
    <ul {...props} className="mt-4 list-disc space-y-2 pl-6 text-[0.95rem] leading-7 text-foreground/70 marker:text-primary" />
  ),
  ol: (props: ComponentPropsWithoutRef<'ol'>) => (
    <ol {...props} className="mt-4 list-decimal space-y-3 pl-6 text-[0.95rem] leading-7 text-foreground/70 marker:font-semibold marker:text-primary" />
  ),
  strong: (props: ComponentPropsWithoutRef<'strong'>) => (
    <strong {...props} className="font-semibold text-foreground" />
  ),
  a: (props: ComponentPropsWithoutRef<'a'>) => (
    <a {...props} className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
  ),
  blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote {...props} className="mt-6 rounded-xl border border-border bg-canvas/55 px-5 py-1 text-sm [&>p]:my-3 [&>p]:text-sm [&>p]:leading-6" />
  ),
  table: (props: ComponentPropsWithoutRef<'table'>) => (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border">
      <table {...props} className="w-full min-w-176 border-collapse text-left text-sm" />
    </div>
  ),
  thead: (props: ComponentPropsWithoutRef<'thead'>) => <thead {...props} className="bg-canvas/65 text-foreground" />,
  tbody: (props: ComponentPropsWithoutRef<'tbody'>) => <tbody {...props} className="divide-y divide-border" />,
  th: (props: ComponentPropsWithoutRef<'th'>) => <th {...props} className="px-4 py-3 align-top font-semibold text-foreground" />,
  td: (props: ComponentPropsWithoutRef<'td'>) => <td {...props} className="px-4 py-3 align-top leading-6 text-foreground/65" />,
  pre: (props: ComponentPropsWithoutRef<'pre'>) => <pre {...props} className="mt-5 overflow-x-auto rounded-xl bg-foreground p-4 text-xs leading-6 text-background" />,
  code: (props: ComponentPropsWithoutRef<'code'>) => <code {...props} className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[0.88em] text-foreground in-[pre]:bg-transparent in-[pre]:p-0 in-[pre]:text-inherit" />,
  hr: () => <hr className="my-12 border-border" />,
}

type GuideLayoutProps = {
  children: ReactNode
  documentTitle: string
  headerTitle: string
  sections: ReadonlyArray<readonly [string, string]>
  returnLabel?: string
  returnTo?: string
}

function GuideLayout({
  children,
  documentTitle,
  headerTitle,
  sections,
  returnLabel = '返回首頁',
  returnTo = '/',
}: GuideLayoutProps) {
  const { hash } = useLocation()

  useEffect(() => {
    const previousTitle = document.title
    document.title = documentTitle
    return () => {
      document.title = previousTitle
    }
  }, [documentTitle])

  useEffect(() => {
    if (!hash) return

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(decodeURIComponent(hash.slice(1)))
        ?.scrollIntoView({ block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [hash])

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to={returnTo} aria-label={returnLabel} className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg pr-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
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
            <div className="flex shrink-0 items-center gap-2 px-2 pb-3 text-sm font-semibold">
              <BookOpen aria-hidden="true" className="size-4" />
              章節目錄
            </div>
            <nav aria-label="使用手冊章節" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:min-h-0 lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
              {sections.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="flex min-h-10 items-center rounded-lg px-3 py-2 text-sm text-foreground/65 transition hover:bg-control-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="min-w-0 rounded-2xl border border-border bg-background px-5 py-8 shadow-sm sm:px-8 lg:px-12 lg:py-12">
          {children}
        </article>
      </main>
    </div>
  )
}

export function GuidePage() {
  return (
    <GuideLayout
      documentTitle="使用手冊｜Co-Canvas"
      headerTitle="Co-Canvas 使用手冊"
      sections={sections}
    >
      <GuideContent components={mdxComponents} />
    </GuideLayout>
  )
}

export function ResearchGuidePage() {
  return (
    <GuideLayout
      documentTitle="研究資料利用方式｜Co-Canvas"
      headerTitle="研究資料利用方式"
      sections={researchSections}
      returnLabel="返回使用手冊"
      returnTo="/guide"
    >
      <ResearchGuideContent components={mdxComponents} />
    </GuideLayout>
  )
}
