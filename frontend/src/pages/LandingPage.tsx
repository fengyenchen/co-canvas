import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'

type SessionState = 'checking' | 'signed-in' | 'signed-out'

export function LandingPage() {
  const [sessionState, setSessionState] =
    useState<SessionState>('checking')

  useEffect(() => {
    let isCancelled = false

    async function checkSession() {
      try {
        const { authClient } = await import('../lib/auth')
        const { data } = await authClient.getSession()

        if (!isCancelled) {
          setSessionState(data?.user ? 'signed-in' : 'signed-out')
        }
      } catch {
        if (!isCancelled) {
          setSessionState('signed-out')
        }
      }
    }

    void checkSession()

    return () => {
      isCancelled = true
    }
  }, [])

  if (sessionState === 'signed-in') {
    return <Navigate to="/projects" replace />
  }

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          to="/"
          aria-label="Co-Canvas 首頁"
          className="inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-lg pr-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <img
            src={coCanvasMark}
            alt=""
            width="44"
            height="44"
            className="size-11 object-contain"
          />
          <span>Co-Canvas</span>
        </Link>

        <nav aria-label="主要導覽" className="flex items-center gap-2">
          <Link
            to="/auth/sign-in?returnTo=%2Fprojects"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            登入
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100dvh-5.25rem)] w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)] lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.16em] text-primary">
              對話 × 節點畫布
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              把對話變成
              <span className="block text-primary">看得見的思考脈絡</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-foreground/65 sm:text-lg">
              選取你想延伸的節點，透過對話讓 AI 協助拆解、比較與整理內容，同時保留你對畫布的控制權。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth/sign-up?returnTo=%2Fprojects"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                免費開始使用
              </Link>
              <Link
                to="/projects/local"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-6 text-sm font-semibold shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                先用本機畫布
              </Link>
            </div>

            {sessionState === 'checking' && (
              <p role="status" className="mt-4 text-xs text-foreground/45">
                正在確認登入狀態…
              </p>
            )}
          </div>

          <div
            aria-label="對話與節點畫布示意"
            className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-background shadow-xl shadow-foreground/5"
          >
            <div className="absolute inset-y-0 left-0 w-[38%] border-r border-border bg-canvas/70 p-4 sm:p-5">
              <div className="h-3 w-16 rounded-full bg-foreground/15" />
              <div className="mt-8 rounded-2xl bg-primary px-3 py-3 text-xs leading-5 text-primary-foreground shadow-sm">
                幫我把研究計畫拆解成可執行步驟
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-background px-3 py-3 text-xs leading-5 text-foreground/65 shadow-sm">
                我會先整理目標、方法、時程與風險。
              </div>
            </div>

            <div className="absolute inset-y-0 right-0 w-[62%] bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:20px_20px]">
              <div className="absolute left-[24%] top-[16%] w-[56%] rounded-xl border border-primary/30 bg-background px-3 py-3 text-xs font-semibold shadow-md">
                研究計畫
              </div>
              <div className="absolute left-[8%] top-[52%] w-[40%] rounded-xl border border-border bg-background px-3 py-3 text-xs shadow-md">
                研究方法
              </div>
              <div className="absolute right-[7%] top-[52%] w-[40%] rounded-xl border border-border bg-background px-3 py-3 text-xs shadow-md">
                執行時程
              </div>
              <div className="absolute left-1/2 top-[38%] h-[14%] w-px bg-foreground/25" />
              <div className="absolute left-[28%] top-[45%] h-px w-[44%] bg-foreground/25" />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
