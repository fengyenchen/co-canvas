import { useEffect, useState, type ReactNode } from 'react'
import { motion, MotionConfig, type HTMLMotionProps } from 'motion/react'
import { CloudUpload, ExternalLink, Film, Link2, MessageSquareText, Play } from 'lucide-react'
import { Link } from 'react-router'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'

type SessionState = 'checking' | 'signed-in' | 'signed-out'

type RevealProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children: ReactNode
  delay?: number
}

function Reveal({ children, delay = 0, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.3, delay, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function LandingPage() {
  const [sessionState, setSessionState] =
    useState<SessionState>('checking')
  const [isSigningOut, setIsSigningOut] = useState(false)

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

  async function handleSignOut() {
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      const { authClient } = await import('../lib/auth')
      await authClient.signOut()
      setSessionState('signed-out')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
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
          <span className="hidden sm:inline">Co-Canvas</span>
        </Link>

        <nav aria-label="主要導覽" className="flex items-center gap-2">
          <a
            href="#features"
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:inline-flex"
          >
            核心功能
          </a>
          <a
            href="#video-context"
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:inline-flex"
          >
            影片脈絡
          </a>
          <a
            href="#comparison"
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:inline-flex"
          >
            介面比較
          </a>
          <a
            href="#use-cases"
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:inline-flex"
          >
            適用情境
          </a>
          <Link
            to="/guide"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:inline-flex"
          >
            使用手冊
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>
          {sessionState === 'signed-in' ? (
            <>
              <Link
                to="/projects"
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                進入專案
              </Link>
              <button
                type="button"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSigningOut ? '登出中…' : '登出'}
              </button>
            </>
          ) : (
            <Link
              to="/auth/sign-in?returnTo=%2Fprojects"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              登入
            </Link>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100dvh-5.25rem)] w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)] lg:py-24">
          <Reveal className="max-w-2xl">
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
                to={sessionState === 'signed-in' ? '/projects' : '/auth/sign-up?returnTo=%2Fprojects'}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {sessionState === 'signed-in' ? '進入專案' : '免費開始使用'}
              </Link>
              <Link
                to="/projects/local"
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-6 text-sm font-semibold shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                先用本機畫布
              </Link>
            </div>

            <div className="mt-4 min-h-4">
              {sessionState === 'checking' && (
                <p role="status" className="text-xs leading-4 text-foreground/45">
                  正在確認登入狀態…
                </p>
              )}
            </div>
          </Reveal>

          <Reveal
            delay={0.08}
            aria-label="對話與節點畫布示意"
            className="relative mx-auto aspect-4/3 w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-background shadow-xl shadow-foreground/5"
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

            <div className="absolute inset-y-0 right-0 w-[62%] bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [bg-size:20px_20px]">
              <div className="absolute left-[24%] top-[16%] w-[56%] rounded-xl border border-primary/30 bg-background px-3 py-3 text-xs font-semibold shadow-md">
                研究計畫
              </div>
              <div className="absolute left-[8%] top-[52%] w-[40%] rounded-xl border border-border bg-background px-3 py-3 text-xs shadow-md">
                研究方法
              </div>
              <div className="absolute right-[7%] top-[52%] w-[40%] rounded-xl border border-border bg-background px-3 py-3 text-xs shadow-md">
                執行時程
              </div>
              <div className="absolute left-1/2 top-[34%] h-[14%] w-px bg-foreground/25" />
              <div className="absolute left-[28%] top-[42%] h-px w-[44%] bg-foreground/25" />
            </div>
          </Reveal>
        </section>

        <section
          id="features"
          aria-labelledby="features-title"
          className="scroll-mt-6 border-t border-border bg-background"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold tracking-[0.16em] text-primary">
                核心功能
              </p>
              <h2
                id="features-title"
                className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                從選定脈絡，到建立結構
              </h2>
              <p className="mt-4 text-base leading-7 text-foreground/60">
                AI 負責提出內容與關係，你決定從哪裡開始、哪些建議值得保留。
              </p>
            </Reveal>

            <Reveal className="mt-12">
              <ol className="grid gap-5 lg:grid-cols-3">
              <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-canvas/55 p-5 shadow-sm sm:p-6">
                <div
                  aria-hidden="true"
                  className="relative h-44 overflow-hidden rounded-xl border border-border bg-background"
                >
                  <div className="absolute left-5 top-5 rounded-full bg-primary/10 px-3 py-1.5 text-[0.7rem] font-medium text-primary">
                    目前延伸
                  </div>
                  <div className="absolute left-[27%] top-[33%] w-[48%] rounded-lg border border-primary bg-background px-3 py-2.5 text-xs font-semibold shadow-md">
                    研究問題
                  </div>
                  <div className="absolute bottom-4 left-4 w-[36%] rounded-lg border border-border bg-background px-3 py-2 text-[0.7rem] text-foreground/55 shadow-sm">
                    研究方法
                  </div>
                  <div className="absolute bottom-4 right-4 w-[36%] rounded-lg border border-border bg-background px-3 py-2 text-[0.7rem] text-foreground/55 shadow-sm">
                    評估方式
                  </div>
                  <div className="absolute left-1/2 top-[60%] h-[14%] w-px bg-foreground/20" />
                  <div className="absolute bottom-[35%] left-[28%] h-px w-[44%] bg-foreground/20" />
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    1
                  </span>
                  <h3 className="text-lg font-semibold">選定對話上下文</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground/60">
                  直接選取想延伸的節點或群組。群組可命名、著色、收合、鎖定與整組複製，系統也能帶入群組內的完整結構，讓大型畫布保持清楚，AI 回應更聚焦。
                </p>
              </li>

              <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-canvas/55 p-5 shadow-sm sm:p-6">
                <div
                  aria-hidden="true"
                  className="relative h-44 overflow-hidden rounded-xl border border-border bg-background p-4"
                >
                  <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-primary px-3 py-2.5 text-[0.7rem] leading-5 text-primary-foreground shadow-sm">
                    比較這兩種研究方法的優缺點
                  </div>
                  <div className="mt-3 max-w-[86%] rounded-2xl rounded-bl-md border border-border bg-canvas px-3 py-2.5 text-[0.7rem] leading-5 text-foreground/60">
                    我會整理成兩個方案與一個比較節點。
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2">
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-[0.65rem] font-medium shadow-sm">
                      方法 A
                    </div>
                    <div className="h-px min-w-4 flex-1 bg-foreground/20" />
                    <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-[0.65rem] font-medium text-primary shadow-sm">
                      比較
                    </div>
                    <div className="h-px min-w-4 flex-1 bg-foreground/20" />
                    <div className="rounded-lg border border-border bg-background px-3 py-2 text-[0.65rem] font-medium shadow-sm">
                      方法 B
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    2
                  </span>
                  <h3 className="text-lg font-semibold">用對話產生結構</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground/60">
                  用自然語言要求 AI 拆解、延伸或比較。結構化結果會轉成節點內容與語意關係，而不是只留在線性訊息中。
                </p>
              </li>

              <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-canvas/55 p-5 shadow-sm sm:p-6">
                <div
                  aria-hidden="true"
                  className="h-44 overflow-hidden rounded-xl border border-border bg-background p-4"
                >
                  <div className="text-xs font-semibold">AI 建議預覽</div>
                  <div className="mt-3 space-y-2">
                    {['釐清研究目標', '拆解執行步驟'].map(
                      (label) => (
                        <div
                          key={label}
                          className="flex items-center gap-2 rounded-lg border border-border bg-canvas/60 px-3 py-2 text-[0.7rem] text-foreground/65"
                        >
                          <span className="size-2 rounded-full bg-primary" />
                          {label}
                        </div>
                      ),
                    )}
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <div className="rounded-md border border-border px-3 py-1.5 text-[0.65rem] text-foreground/55">
                      取消
                    </div>
                    <div className="rounded-md bg-primary px-3 py-1.5 text-[0.65rem] font-medium text-primary-foreground">
                      加入畫布
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    3
                  </span>
                  <h3 className="text-lg font-semibold">預覽後再加入</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground/60">
                  AI 不會直接改動畫布。先檢查建議的節點與連線，再選擇加入、重新生成或取消，保留操作控制權。
                </p>
              </li>
              </ol>
            </Reveal>

            <Reveal className="mt-6">
              <aside className="rounded-2xl border border-border bg-background px-5 py-4 text-sm leading-6 text-foreground/60 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-8">
                <div>
                  <strong className="block shrink-0 font-semibold text-foreground">支援人機協作研究</strong>
                  <p className="mt-1">雲端專案擁有者可匯出 AI 建議的接受、取消、重新生成、編輯狀態與決策時間，作為互動行為分析資料。</p>
                </div>
                <div className="mt-3 flex shrink-0 flex-col gap-2 sm:mt-0 sm:flex-row">
                  <Link
                    to="/guide/research"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 font-medium text-foreground transition hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    研究資料指南
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                  <Link
                    to="/research/analyze"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    分析 CSV
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </aside>
            </Reveal>
          </div>
        </section>

        <section
          id="video-context"
          aria-labelledby="video-context-title"
          className="scroll-mt-6 border-t border-border bg-canvas/55"
        >
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,0.82fr)_minmax(28rem,1.18fr)]">
            <Reveal className="max-w-xl">
              <p className="text-sm font-semibold tracking-[0.16em] text-primary">
                影片脈絡
              </p>
              <h2
                id="video-context-title"
                className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                讓影片成為畫布的一部分
              </h2>
              <p className="mt-5 text-base leading-8 text-foreground/60">
                影片不是固定在頁面上方的附件，而是能移動、連線與整理的節點。把重要片段連到文字節點，讓觀看過程留下可回顧的結構。
              </p>

              <ul className="mt-8 space-y-5">
                <li className="flex gap-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Film aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">一張畫布，多個影片節點</h3>
                    <p className="mt-1 text-sm leading-6 text-foreground/60">
                      每支影片都能各自命名、補充內容，並和相關概念建立連線。
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Link2 aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">用時間區間標記片段</h3>
                    <p className="mt-1 text-sm leading-6 text-foreground/60">
                      可選擇全部影片或自訂開始與結束時間；欄位會依片長切換秒、分:秒或時:分:秒，點一下即可回到對應片段。
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MessageSquareText aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">直接和選取片段對話</h3>
                    <p className="mt-1 text-sm leading-6 text-foreground/60">
                      從片段文字節點進入對話，Gemini 會讀取所選的 YouTube、Dropbox MP4／MOV 或公開 MP4／MOV 時間區間，依實際影音內容回答。
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CloudUpload aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">安全處理大型影片</h3>
                    <p className="mt-1 text-sm leading-6 text-foreground/60">
                      Dropbox 與公開 MP4／MOV 最高支援 450 MB；後端下載檔上傳後立即刪除，Gemini 檔案會安全快取約 47 小時供後續對話重用。
                    </p>
                  </div>
                </li>
              </ul>
            </Reveal>

            <Reveal
              delay={0.08}
              aria-label="影片節點連接片段筆記的示意圖"
              className="rounded-3xl border border-border bg-background p-5 shadow-xl shadow-foreground/5 sm:p-7"
            >
              <div className="rounded-2xl border border-border bg-canvas/55 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Film aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">研究訪談紀錄</p>
                    <p className="mt-0.5 text-xs text-foreground/50">影片節點</p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl bg-foreground px-4 py-5 text-background">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-background text-foreground">
                      <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-background/25">
                        <div className="h-full w-[38%] rounded-full bg-background" />
                      </div>
                      <div className="mt-2 flex justify-between text-[0.65rem] text-background/65">
                        <span>03:12</span>
                        <span>12:40</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div aria-hidden="true" className="mx-auto h-8 w-px bg-foreground/20" />

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['研究動機', '03:12–04:05'],
                  ['關鍵發現', '07:28–08:16'],
                ].map(([title, time]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-border bg-background p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{title}</p>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-medium text-primary">
                        {time}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-foreground/55">
                      將片段重點整理成可以延伸與連接的文字節點。
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <div>
                  <p className="text-xs font-medium text-foreground/50">
                    AI 可分析
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      'YouTube',
                      'Dropbox MP4／MOV',
                      '公開 MP4／MOV',
                    ].map((provider) => (
                      <span
                        key={provider}
                        className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary"
                      >
                        {provider}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-medium text-foreground/50">
                    播放與片段定位
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Vimeo', 'Bilibili'].map((provider) => (
                      <span
                        key={provider}
                        className="rounded-full border border-border bg-canvas/55 px-3 py-1.5 text-xs text-foreground/65"
                      >
                        {provider}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-foreground/45">
                  大型影片只有首次分析需要下載與上傳，後續對話會重用有效快取；播放與時間定位能力依各平台官方播放器而異。
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="comparison"
          aria-labelledby="comparison-title"
          className="scroll-mt-6 border-t border-border bg-background"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold tracking-[0.16em] text-primary">
                介面比較
              </p>
              <h2
                id="comparison-title"
                className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                不只是把聊天搬到畫布上
              </h2>
              <p className="mt-4 text-base leading-7 text-foreground/60">
                Co-Canvas 讓你用節點指定脈絡、檢查 AI 建議，並持續重組內容，不必在長對話裡反覆尋找資訊。
              </p>
            </Reveal>

            <Reveal className="mt-10">
              <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                <table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">
                  純聊天介面與 Co-Canvas 的功能比較
                </caption>
                <thead>
                  <tr className="border-b border-border bg-primary/5">
                    <th
                      scope="col"
                      className="w-[24%] px-3 py-4 text-xs font-semibold text-foreground/55 sm:px-6 sm:text-sm"
                    >
                      比較項目
                    </th>
                    <th
                      scope="col"
                      className="w-[34%] px-3 py-4 text-xs font-semibold sm:px-6 sm:text-sm"
                    >
                      純聊天介面
                    </th>
                    <th
                      scope="col"
                      className="w-[42%] px-3 py-4 text-xs font-semibold text-primary sm:px-6 sm:text-sm"
                    >
                      Co-Canvas
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    [
                      '資訊呈現',
                      '訊息依時間逐則堆疊',
                      '用節點與連線保留整體結構',
                    ],
                    [
                      '指定上下文',
                      '重新描述或引用先前訊息',
                      '直接選取想延伸的節點或群組',
                    ],
                    [
                      '採用 AI 結果',
                      '回覆直接混入對話紀錄',
                      '先預覽，再選擇加入或取消',
                    ],
                    [
                      '回顧與修改',
                      '上下捲動尋找既有內容',
                      '直接移動、編輯與重組節點',
                    ],
                  ].map(([label, chat, canvas]) => (
                    <tr key={label} className="align-top">
                      <th
                        scope="row"
                        className="px-3 py-5 text-xs font-semibold leading-5 text-foreground/65 sm:px-6 sm:text-sm"
                      >
                        {label}
                      </th>
                      <td className="px-3 py-5 text-xs leading-5 text-foreground/55 sm:px-6 sm:text-sm sm:leading-6">
                        {chat}
                      </td>
                      <td className="bg-primary/3 px-3 py-5 text-xs font-medium leading-5 sm:px-6 sm:text-sm sm:leading-6">
                        {canvas}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </Reveal>

            <p className="mt-6 text-sm leading-6 text-foreground/55">
              核心差異不是產生更多內容，而是讓你更清楚地決定 AI 要處理什麼，以及哪些結果要留在畫布上。
            </p>
          </div>
        </section>

        <section
          id="use-cases"
          aria-labelledby="use-cases-title"
          className="scroll-mt-6 border-t border-border bg-background"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold tracking-[0.16em] text-primary">
                適用情境
              </p>
              <h2
                id="use-cases-title"
                className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                把複雜任務整理成下一步
              </h2>
              <p className="mt-4 text-base leading-7 text-foreground/60">
                從發散想法到形成計畫，用同一張畫布保留內容之間的脈絡。
              </p>
            </Reveal>

            <Reveal className="mt-12">
              <ul className="grid gap-5 md:grid-cols-2">
              {[
                {
                  title: '研究計畫拆解',
                  description:
                    '將研究問題、方法、時程與風險整理成可追蹤的結構。',
                  labels: ['研究問題', '研究方法', '評估方式'],
                },
                {
                  title: '專案任務規劃',
                  description:
                    '把目標拆成階段、執行事項與下一步，減少規劃遺漏。',
                  labels: ['專案目標', '執行階段', '下一步'],
                },
                {
                  title: '文章大綱整理',
                  description:
                    '重新排列論點、段落與佐證，快速看出內容是否連貫。',
                  labels: ['核心論點', '段落結構', '佐證資料'],
                },
                {
                  title: '概念比較與腦力激盪',
                  description:
                    '先延伸多個方向，再集中比較差異、關聯與可行性。',
                  labels: ['想法 A', '比較', '想法 B'],
                },
              ].map((item, index) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-border bg-canvas/45 p-5 shadow-sm sm:p-6"
                >
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-foreground/60">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div
                    aria-hidden="true"
                    className="mt-6 flex min-w-0 items-center gap-2 overflow-hidden"
                  >
                    {item.labels.map((label, labelIndex) => (
                      <div key={label} className="contents">
                        {labelIndex > 0 && (
                          <span className="h-px min-w-3 flex-1 bg-foreground/20" />
                        )}
                        <span className="max-w-[8rem] shrink-0 truncate rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground/65 shadow-sm">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section
          aria-labelledby="cta-title"
          className="border-t border-border bg-background"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal className="overflow-hidden rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground shadow-xl shadow-foreground/10 sm:px-12 sm:py-16">
              <p className="text-sm font-semibold tracking-[0.16em] text-primary-foreground/70">
                開始整理你的想法
              </p>
              <h2
                id="cta-title"
                className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                選一個節點，讓對話從脈絡開始
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-primary-foreground/70 sm:text-base">
                可以先使用本機畫布，不需登入；需要跨裝置保存時，再建立帳號與雲端專案。
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to={sessionState === 'signed-in' ? '/projects' : '/auth/sign-up?returnTo=%2Fprojects'}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-background px-6 text-sm font-semibold text-foreground shadow-sm transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/70"
                >
                  {sessionState === 'signed-in' ? '進入專案' : '建立雲端專案'}
                </Link>
                <Link
                  to="/projects/local"
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-primary-foreground/30 px-6 text-sm font-semibold text-primary-foreground transition hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                >
                  開啟本機畫布
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-canvas/55">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link
            to="/"
            aria-label="回到 Co-Canvas 首頁"
            className="inline-flex min-h-11 cursor-pointer items-center gap-3 self-start rounded-lg pr-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <img
              src={coCanvasMark}
              alt=""
              aria-hidden="true"
              className="size-9 object-contain"
            />
            <span>Co-Canvas</span>
          </Link>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Link
              to="/guide"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              使用手冊
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
            <p className="text-sm leading-6 text-foreground/50">對話與節點畫布的人機協作系統</p>
          </div>
        </div>
      </footer>
      </div>
    </MotionConfig>
  )
}
