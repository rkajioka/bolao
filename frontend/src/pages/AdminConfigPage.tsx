import { lazy, Suspense, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, Palette } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useToast } from '@/components/Toast'
import { OwnerEmpresaPicker } from '@/components/OwnerEmpresaPicker'
import { useAuth } from '@/features/auth/AuthContext'
import { useResolvedEmpresaForAdmin } from '@/hooks/useResolvedEmpresaForAdmin'
import { empresaService } from '@/services/empresa.service'

const AdminSpecials = lazy(() =>
  import('@/features/admin/specials/AdminSpecials').then((m) => ({ default: m.AdminSpecials })),
)
const AdminAppearance = lazy(() =>
  import('@/features/admin/appearance/AdminAppearance').then((m) => ({ default: m.AdminAppearance })),
)

type ConfigTab = 'pontuacao' | 'aparencia'

const tabs: { key: ConfigTab; label: string; icon: React.ReactNode }[] = [
  { key: 'pontuacao', label: 'Pontuação', icon: <SlidersHorizontal size={16} /> },
  { key: 'aparencia', label: 'Aparência', icon: <Palette size={16} /> },
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

export function AdminConfigPage() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('pontuacao')
  const { success, error } = useToast()
  const { empresaId: authEmpresaId } = useAuth()
  const { resolvedEmpresaId, setOwnerEmpresaId, needsOwnerEmpresaPick } = useResolvedEmpresaForAdmin()

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
    enabled: needsOwnerEmpresaPick,
  })

  useEffect(() => {
    if (!needsOwnerEmpresaPick || resolvedEmpresaId != null || empresas.length === 0) return
    setOwnerEmpresaId(empresas[0].id)
  }, [needsOwnerEmpresaPick, resolvedEmpresaId, empresas, setOwnerEmpresaId])

  const effectiveEmpresaId = needsOwnerEmpresaPick ? resolvedEmpresaId : authEmpresaId

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Configuração do bolão</h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Pontuação e cores do bolão da empresa
        </p>
      </div>

      {needsOwnerEmpresaPick && (
        <OwnerEmpresaPicker value={resolvedEmpresaId} onChange={setOwnerEmpresaId} />
      )}

      {!needsOwnerEmpresaPick && effectiveEmpresaId == null && (
        <p className="text-sm px-1" style={{ color: 'var(--danger)' }}>
          Sua conta não está vinculada a uma empresa.
        </p>
      )}

      {effectiveEmpresaId != null && (
        <>
          <div
            className="flex gap-1 overflow-x-auto scrollbar-hidden"
            role="tablist"
            aria-label="Configuração"
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={activeTab === t.key}
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

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              role="tabpanel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <Suspense fallback={<TabFallback />}>
                {activeTab === 'pontuacao' && (
                  <AdminSpecials
                    variant="scoring"
                    empresaId={effectiveEmpresaId}
                    success={success}
                    error={error}
                  />
                )}
                {activeTab === 'aparencia' && (
                  <AdminAppearance empresaId={effectiveEmpresaId} />
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
