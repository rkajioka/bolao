import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
const AdminConfigPage = lazy(() =>
  import('@/pages/AdminConfigPage').then((m) => ({ default: m.AdminConfigPage })),
)
const RegrasPage = lazy(() =>
  import('@/pages/RegrasPage').then((m) => ({ default: m.RegrasPage })),
)
const EquipePage = lazy(() =>
  import('@/pages/EquipePage').then((m) => ({ default: m.EquipePage })),
)
const PerfilPage = lazy(() =>
  import('@/pages/PerfilPage').then((m) => ({ default: m.PerfilPage })),
)
const AtivarContaPage = lazy(() =>
  import('@/pages/AtivarContaPage').then((m) => ({ default: m.AtivarContaPage })),
)
const EsqueciSenhaPage = lazy(() =>
  import('@/pages/EsqueciSenhaPage').then((m) => ({ default: m.EsqueciSenhaPage })),
)
const RedefinirSenhaPage = lazy(() =>
  import('@/pages/RedefinirSenhaPage').then((m) => ({ default: m.RedefinirSenhaPage })),
)

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div
        className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(53,208,127,0.3)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(53,208,127,0.2)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}

function loginPathWithNext(pathname: string, search: string) {
  const next = `${pathname}${search}`
  return `/login?next=${encodeURIComponent(next)}`
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()
  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to={loginPathWithNext(location.pathname, location.search)} replace />
  }
  if (user?.primeiro_login) return <Navigate to="/primeiro-acesso" replace />
  return <>{children}</>
}

function ParticipantRoute({ children }: { children: React.ReactNode }) {
  const { isOwner } = useAuth()
  if (isOwner) return <Navigate to="/jogos" replace />
  return <>{children}</>
}

/** Administrador da empresa ou proprietário (equipe, pontuação, aparência). */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { canManageEquipe } = useAuth()
  if (!canManageEquipe) return <Navigate to="/jogos" replace />
  return <>{children}</>
}

/** Somente proprietário da plataforma (torneio global). */
function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { canManageTorneio } = useAuth()
  if (!canManageTorneio) return <Navigate to="/jogos" replace />
  return <>{children}</>
}

function WildcardRedirect() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to={loginPathWithNext(location.pathname, location.search)} replace />
  }
  return <Navigate to="/jogos" replace />
}

function AppShell() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
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
      <Route
        path="/ativar-conta"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <AtivarContaPage />
          </Suspense>
        }
      />
      <Route
        path="/esqueci-senha"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <EsqueciSenhaPage />
          </Suspense>
        }
      />
      <Route
        path="/redefinir-senha"
        element={
          <Suspense fallback={<LoadingScreen />}>
            <RedefinirSenhaPage />
          </Suspense>
        }
      />

      {/* Protegidas */}
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/jogos" replace />} />
        <Route
          path="/jogos"
          element={
            <Suspense fallback={<RouteFallback />}>
              <JogosPage />
            </Suspense>
          }
        />
        <Route
          path="/especiais"
          element={
            <ParticipantRoute>
              <Suspense fallback={<RouteFallback />}>
                <EspeciaisPage />
              </Suspense>
            </ParticipantRoute>
          }
        />
        <Route
          path="/regras"
          element={
            <ParticipantRoute>
              <Suspense fallback={<RouteFallback />}>
                <RegrasPage />
              </Suspense>
            </ParticipantRoute>
          }
        />
        <Route path="/grupos" element={<Navigate to="/jogos" replace />} />
        <Route
          path="/ranking"
          element={
            <Suspense fallback={<RouteFallback />}>
              <RankingPage />
            </Suspense>
          }
        />
        <Route
          path="/perfil"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PerfilPage />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <OwnerRoute>
              <Suspense fallback={<RouteFallback />}>
                <AdminPage />
              </Suspense>
            </OwnerRoute>
          }
        />
        <Route
          path="/admin/config"
          element={
            <AdminRoute>
              <Suspense fallback={<RouteFallback />}>
                <AdminConfigPage />
              </Suspense>
            </AdminRoute>
          }
        />
        <Route
          path="/equipe"
          element={
            <ParticipantRoute>
              <AdminRoute>
                <Suspense fallback={<RouteFallback />}>
                  <EquipePage />
                </Suspense>
              </AdminRoute>
            </ParticipantRoute>
          }
        />
      </Route>
      <Route path="*" element={<WildcardRedirect />} />
    </Routes>
  )
}
