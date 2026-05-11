import { lazy, Suspense, useState } from 'react'
import { Users, Trophy, Medal, Building2 } from 'lucide-react'
import { useToast } from '@/components/Toast'

const AdminGames = lazy(() =>
  import('@/features/admin/games/AdminGames').then((m) => ({ default: m.AdminGames })),
)
const AdminUsers = lazy(() =>
  import('@/features/admin/users/AdminUsers').then((m) => ({ default: m.AdminUsers })),
)
const AdminSpecials = lazy(() =>
  import('@/features/admin/specials/AdminSpecials').then((m) => ({ default: m.AdminSpecials })),
)
const AdminEmpresas = lazy(() =>
  import('@/features/admin/empresas/AdminEmpresas').then((m) => ({ default: m.AdminEmpresas })),
)

type AdminTab = 'jogos' | 'usuarios' | 'empresas' | 'resultados'

const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: 'jogos', label: 'Jogos', icon: <Trophy size={16} /> },
  { key: 'usuarios', label: 'Usuários', icon: <Users size={16} /> },
  { key: 'empresas', label: 'Empresas', icon: <Building2 size={16} /> },
  { key: 'resultados', label: 'Resultados', icon: <Medal size={16} /> },
]

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="w-7 h-7 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(53,208,127,0.2)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('jogos')
  const { success, error } = useToast()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,92,122,0.15)', border: '1px solid rgba(255,92,122,0.3)' }}
          aria-hidden="true"
        >
          <Trophy size={16} style={{ color: 'var(--danger)' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold">Gestão do torneio</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cadastro de jogos, usuários globais e resultado oficial</p>
        </div>
      </div>

      <div
        className="flex gap-1 overflow-x-auto scrollbar-hidden"
        role="tablist"
        aria-label="Seções de administração"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeTab === t.key}
            aria-controls={`tabpanel-${t.key}`}
            onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150"
            style={{
              background: activeTab === t.key ? 'rgba(255,255,255,0.10)' : 'transparent',
              border: `1px solid ${activeTab === t.key ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
              color: activeTab === t.key ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div id={`tabpanel-${activeTab}`} role="tabpanel">
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'jogos' && <AdminGames success={success} error={error} />}
          {activeTab === 'usuarios' && <AdminUsers success={success} error={error} />}
          {activeTab === 'empresas' && <AdminEmpresas success={success} error={error} />}
          {activeTab === 'resultados' && (
            <AdminSpecials variant="results" success={success} error={error} />
          )}
        </Suspense>
      </div>
    </div>
  )
}
