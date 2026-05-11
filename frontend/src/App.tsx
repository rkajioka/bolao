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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />
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
        <Route path="/jogos" element={<JogosPage />} />
        <Route path="/especiais" element={<EspeciaisPage />} />
        <Route path="/regras" element={<RegrasPage />} />
        <Route path="/grupos" element={<Navigate to="/jogos" replace />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route
          path="/admin"
          element={
            <OwnerRoute>
              <AdminPage />
            </OwnerRoute>
          }
        />
        <Route
          path="/admin/config"
          element={
            <AdminRoute>
              <AdminConfigPage />
            </AdminRoute>
          }
        />
        <Route
          path="/equipe"
          element={
            <AdminRoute>
              <EquipePage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/jogos" replace />} />
    </Routes>
  )
}
