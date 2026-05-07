import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { PrimeiroAcessoPage } from '@/pages/PrimeiroAcessoPage'
import { JogosPage } from '@/pages/JogosPage'
import { RankingPage } from '@/pages/RankingPage'
import { EspeciaisPage } from '@/pages/EspeciaisPage'
import { GruposPage } from '@/pages/GruposPage'
import { AdminPage } from '@/pages/AdminPage'

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
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/primeiro-acesso" element={<PrimeiroAcessoPage />} />
      <Route path="/" element={<Navigate to="/jogos" replace />} />
      <Route path="/jogos" element={<AppPage><JogosPage /></AppPage>} />
      <Route path="/especiais" element={<AppPage><EspeciaisPage /></AppPage>} />
      <Route path="/grupos" element={<AppPage><GruposPage /></AppPage>} />
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
