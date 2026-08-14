import { Link } from 'react-router'

export function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-background p-8 shadow-sm">
        <p className="text-sm font-medium text-primary">Co-Canvas</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          專案首頁
        </h1>
        <p className="mt-3 leading-7 text-foreground/65">
          下一步會在這裡顯示 Neon 中的專案列表。
        </p>
        <Link
          to="/projects/local"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          暫時進入本機畫布
        </Link>
      </section>
    </main>
  )
}
