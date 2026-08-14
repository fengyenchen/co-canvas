import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listProjects } from '../api/projects'
import { ApiRequestError } from '../api/errors'
import type { ProjectSummary } from '../types/project'

function formatUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '更新時間不明'
  }

  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getLoadErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.detail
  }

  if (error instanceof TypeError) {
    return '無法連線後端，請確認服務已啟動。'
  }

  return '專案資料格式無效，請稍後再試。'
}

export function HomePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let isCancelled = false

    async function loadProjects() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const result = await listProjects()

        if (!isCancelled) {
          setProjects(result)
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(getLoadErrorMessage(error))
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      isCancelled = true
    }
  }, [loadAttempt])

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Co-Canvas</p>
            <h1 className="mt-1 text-3xl font-semibold text-foreground">
              專案
            </h1>
            <p className="mt-2 text-foreground/60">
              選擇一個專案，繼續整理你的思考脈絡。
            </p>
          </div>

          <Link
            to="/projects/local"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            開啟本機畫布
          </Link>
        </header>

        <section className="py-8" aria-labelledby="project-list-title">
          <h2
            id="project-list-title"
            className="mb-4 text-lg font-semibold text-foreground"
          >
            你的專案
          </h2>

          {isLoading && (
            <div
              role="status"
              aria-label="正在載入專案"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-xl border border-border bg-background/70"
                />
              ))}
            </div>
          )}

          {!isLoading && errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-border bg-background p-6"
            >
              <h3 className="font-semibold text-foreground">
                無法載入專案
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground/65">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-4 min-h-11 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                重新載入
              </button>
            </div>
          )}

          {!isLoading && !errorMessage && projects.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-background/70 px-6 py-12 text-center">
              <h3 className="font-semibold text-foreground">
                還沒有雲端專案
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground/60">
                下一步加入新增專案後，就能從這裡開始建立。
              </p>
            </div>
          )}

          {!isLoading && !errorMessage && projects.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    to={`/projects/${project.id}`}
                    className="group flex min-h-32 flex-col justify-between rounded-xl border border-border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transform-none"
                  >
                    <h3 className="line-clamp-2 font-semibold text-foreground">
                      {project.name}
                    </h3>
                    <div className="mt-6 flex items-center justify-between gap-3 text-sm text-foreground/55">
                      <span>
                        更新於 {formatUpdatedAt(project.updatedAt)}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
