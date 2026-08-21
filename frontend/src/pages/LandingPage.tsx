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
          <a
            href="#features"
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:inline-flex"
          >
            核心功能
          </a>
          <a
            href="#comparison"
            className="hidden min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-foreground/65 transition hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:inline-flex"
          >
            介面比較
          </a>
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
              <div className="absolute left-1/2 top-[38%] h-[14%] w-px bg-foreground/25" />
              <div className="absolute left-[28%] top-[45%] h-px w-[44%] bg-foreground/25" />
            </div>
          </div>
        </section>

        <section
          id="features"
          aria-labelledby="features-title"
          className="scroll-mt-6 border-t border-border bg-background"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
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
            </div>

            <ol className="mt-12 grid gap-5 lg:grid-cols-3">
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
                  直接選取想延伸的節點。系統只帶入該節點及相鄰內容，讓 AI 回應更聚焦、更容易預測。
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
          </div>
        </section>

        <section
          id="comparison"
          aria-labelledby="comparison-title"
          className="scroll-mt-6 border-t border-border bg-canvas/55"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="max-w-2xl">
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
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
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
                      '直接選取想延伸的節點',
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

            <p className="mt-6 text-sm leading-6 text-foreground/55">
              核心差異不是產生更多內容，而是讓你更清楚地決定 AI 要處理什麼，以及哪些結果要留在畫布上。
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
