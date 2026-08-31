import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  MailX,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router'
import {
  getAuthAccountOverview,
  type AuthAccountOverview,
} from '../api/authAdmin'
import { ApiRequestError } from '../api/errors'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'

type AccountFilter = 'all' | 'verified' | 'waiting'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '時間不明'
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function errorText(error: unknown) {
  if (error instanceof ApiRequestError) return error.detail
  if (error instanceof TypeError) return '無法連線後端，請確認服務已啟動。'
  return '帳號資料格式無效，請稍後再試。'
}

export function AuthAdminPage() {
  const [overview, setOverview] = useState<AuthAccountOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<AccountFilter>('all')
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const result = await getAuthAccountOverview()
        if (!cancelled) setOverview(result)
      } catch (error) {
        if (!cancelled) setErrorMessage(errorText(error))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const accounts = useMemo(() => {
    if (!overview) return []
    const normalizedSearch = search.trim().toLowerCase()
    return overview.accounts.filter(
      (account) =>
        (filter === 'all' || account.status === filter) &&
        (!normalizedSearch || account.email.includes(normalizedSearch)),
    )
  }, [filter, overview, search])

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <img src={coCanvasMark} alt="" className="size-14 sm:size-16" />
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground/55">
                <ShieldCheck className="size-4" aria-hidden="true" />
                系統管理
              </div>
              <h1 className="mt-1 text-3xl font-semibold text-foreground">
                帳號驗證管理
              </h1>
              <p className="mt-2 text-sm leading-6 text-foreground/60">
                查看目前驗證狀態與不含明文 Email 的清理紀錄。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/projects"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              返回專案
            </Link>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setReloadKey((value) => value + 1)}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              重新整理
            </button>
          </div>
        </header>

        {isLoading && !overview ? (
          <p role="status" className="py-16 text-center text-foreground/55">
            正在載入帳號狀態…
          </p>
        ) : errorMessage ? (
          <section className="my-8 rounded-2xl border border-destructive/25 bg-background p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              無法載入管理資料
            </h2>
            <p role="alert" className="mt-2 text-sm leading-6 text-destructive">
              {errorMessage}
            </p>
          </section>
        ) : overview ? (
          <>
            <section
              aria-label="帳號狀態摘要"
              className="grid gap-3 py-6 sm:grid-cols-3"
            >
              {[
                {
                  label: '已驗證',
                  value: overview.counts.verified,
                  Icon: CheckCircle2,
                  tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                },
                {
                  label: '等待驗證',
                  value: overview.counts.waiting,
                  Icon: Clock3,
                  tone: 'text-amber-800 bg-amber-50 border-amber-200',
                },
                {
                  label: '永久退信',
                  value: overview.counts.permanentBounce,
                  Icon: MailX,
                  tone: 'text-red-700 bg-red-50 border-red-200',
                },
              ].map(({ label, value, Icon, tone }) => (
                <article
                  key={label}
                  className="rounded-2xl border border-border bg-background p-5 shadow-sm"
                >
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl border ${tone}`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-sm text-foreground/55">{label}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                    {value.toLocaleString('zh-TW')}
                  </p>
                </article>
              ))}
            </section>

            <section className="rounded-2xl border border-border bg-background shadow-sm">
              <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    現有帳號
                  </h2>
                  <p className="mt-1 text-sm text-foreground/55">
                    顯示 Neon Auth 中仍存在的帳號。
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[15rem_9rem]">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-foreground/65">
                      搜尋 Email
                    </span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-foreground/65">
                      驗證狀態
                    </span>
                    <select
                      value={filter}
                      onChange={(event) =>
                        setFilter(event.target.value as AccountFilter)
                      }
                      className="min-h-11 w-full cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="all">全部</option>
                      <option value="verified">已驗證</option>
                      <option value="waiting">等待驗證</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <thead className="bg-canvas text-foreground/55">
                    <tr>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">狀態</th>
                      <th className="px-5 py-3 font-medium">註冊時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.email} className="border-t border-border">
                        <td className="px-5 py-3 font-medium text-foreground">
                          {account.email}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                              account.status === 'verified'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-800'
                            }`}
                          >
                            {account.status === 'verified'
                              ? '已驗證'
                              : '等待驗證'}
                          </span>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-foreground/60">
                          {formatDate(account.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {accounts.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-foreground/50">
                    沒有符合條件的帳號。
                  </p>
                )}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-background shadow-sm">
              <div className="border-b border-border p-5">
                <h2 className="text-xl font-semibold text-foreground">
                  匿名清理紀錄
                </h2>
                <p className="mt-1 text-sm leading-6 text-foreground/55">
                  只保存 HMAC 雜湊、刪除原因與時間，不保存被刪除帳號的明文 Email。
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                  <thead className="bg-canvas text-foreground/55">
                    <tr>
                      <th className="px-5 py-3 font-medium">Email 雜湊</th>
                      <th className="px-5 py-3 font-medium">原因</th>
                      <th className="px-5 py-3 font-medium">刪除時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.cleanupEvents.map((event) => (
                      <tr
                        key={`${event.emailHash}-${event.deletedAt}`}
                        className="border-t border-border"
                      >
                        <td
                          title={event.emailHash}
                          className="px-5 py-3 font-mono text-xs text-foreground/70"
                        >
                          {event.emailHash.slice(0, 12)}…{event.emailHash.slice(-8)}
                        </td>
                        <td className="px-5 py-3 text-foreground/70">
                          {event.reason === 'permanent_bounce'
                            ? '永久退信'
                            : '超過 24 小時未驗證'}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-foreground/60">
                          {formatDate(event.deletedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {overview.cleanupEvents.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-foreground/50">
                    尚無帳號清理紀錄。
                  </p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
