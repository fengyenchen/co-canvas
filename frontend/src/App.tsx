import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({
    default: module.LandingPage,
  })),
)

const HomePage = lazy(() =>
  import('./pages/HomePage').then((module) => ({
    default: module.HomePage,
  })),
)

const GuidePage = lazy(() =>
  import('./pages/GuidePage').then((module) => ({
    default: module.GuidePage,
  })),
)

const ResearchGuidePage = lazy(() =>
  import('./pages/ResearchGuidePage').then((module) => ({
    default: module.ResearchGuidePage,
  })),
)

const ResearchAnalysisPage = lazy(() =>
  import('./pages/ResearchAnalysisPage').then((module) => ({
    default: module.ResearchAnalysisPage,
  })),
)

const EditorPage = lazy(() =>
  import('./pages/EditorPage').then((module) => ({
    default: module.EditorPage,
  })),
)

const AuthPage = lazy(() =>
  import('./pages/AuthPage').then((module) => ({
    default: module.AuthPage,
  })),
)

const AuthAdminPage = lazy(() =>
  import('./pages/AuthAdminPage').then((module) => ({
    default: module.AuthAdminPage,
  })),
)

type LazyPageProps = {
  children: ReactNode
  message: string
}

function LazyPage({ children, message }: LazyPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
          <p role="status" className="text-sm text-foreground/60">
            {message}
          </p>
        </main>
      }
    >
      {children}
    </Suspense>
  )
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <LazyPage message="正在載入首頁…">
            <LandingPage />
          </LazyPage>
        }
      />
      <Route
        path="/projects"
        element={
          <LazyPage message="正在載入專案…">
            <HomePage />
          </LazyPage>
        }
      />
      <Route
        path="/guide"
        element={
          <LazyPage message="正在載入使用手冊…">
            <GuidePage />
          </LazyPage>
        }
      />
      <Route
        path="/guide/example"
        element={
          <LazyPage message="正在載入使用範例…">
            <EditorPage mode="example" />
          </LazyPage>
        }
      />
      <Route
        path="/guide/research"
        element={
          <LazyPage message="正在載入研究資料指南…">
            <ResearchGuidePage />
          </LazyPage>
        }
      />
      <Route
        path="/research/analyze"
        element={
          <LazyPage message="正在載入研究分析工具…">
            <ResearchAnalysisPage />
          </LazyPage>
        }
      />
      <Route
        path="/auth"
        element={<Navigate to="/auth/sign-in" replace />}
      />
      <Route
        path="/auth/:authPath"
        element={
          <LazyPage message="正在載入登入頁…">
            <AuthPage />
          </LazyPage>
        }
      />
      <Route
        path="/admin/auth"
        element={
          <LazyPage message="正在載入帳號管理…">
            <AuthAdminPage />
          </LazyPage>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <LazyPage message="正在載入畫布…">
            <EditorPage />
          </LazyPage>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
