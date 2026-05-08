import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const PrimeiroAcessoPage = lazy(() =>
  import('@/pages/PrimeiroAcessoPage').then((m) => ({ default: m.PrimeiroAcessoPage })),
)
const JogosPage = lazy(() => import('@/pages/JogosPage').then((m) => ({ default: m.JogosPage })))
const RankingPage = lazy(() =>
  import('@/pages/RankingPage').then((m) => ({ default: m.RankingPage })),
)
const EspeciaisPage = lazy(() =>
  import('@/pages/EspeciaisPage').then((m) => ({ default: m.EspeciaisPage })),
)
const AdminPage = lazy(() => import('@/pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const RegrasPage = lazy(() =>
  import('@/pages/RegrasPage').then((m) => ({ default: m.RegrasPage })),
)

function LoadingScreen() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(53,208,127,0.3)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(53,208,127,0.2)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/jogos" replace />
  return <>{children}</>
}

function AppPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route
        path="/primeiro-acesso"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <PrimeiroAcessoPage />
          </Suspense>
        }
      />
      <Route path="/" element={<Navigate to="/jogos" replace />} />
      <Route path="/jogos" element={<AppPage><JogosPage /></AppPage>} />
      <Route path="/especiais" element={<AppPage><EspeciaisPage /></AppPage>} />
      <Route path="/regras" element={<AppPage><RegrasPage /></AppPage>} />
      <Route path="/grupos" element={<Navigate to="/jogos" replace />} />
      <Route path="/ranking" element={<AppPage><RankingPage /></AppPage>} />
      <Route
        path="/admin"
        element={
          <AppPage>
            <AdminRoute><AdminPage /></AdminRoute>
          </AppPage>
        }
      />
      <Route path="*" element={<Navigate to="/jogos" replace />} />
    </Routes>
  )
}
