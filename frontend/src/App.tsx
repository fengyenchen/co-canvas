import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { EditorPage } from './pages/EditorPage'
import { HomePage } from './pages/HomePage'

const AuthPage = lazy(() =>
  import('./pages/AuthPage').then((module) => ({
    default: module.AuthPage,
  })),
)

function AuthPageRoute() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
          <p role="status" className="text-sm text-foreground/60">
            正在載入登入頁…
          </p>
        </main>
      }
    >
      <AuthPage />
    </Suspense>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/auth"
        element={<Navigate to="/auth/sign-in" replace />}
      />
      <Route path="/auth/:authPath" element={<AuthPageRoute />} />
      <Route path="/projects/:projectId" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
