import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { adminService } from '@/services/admin.service'
import { useToast } from '@/components/Toast'

/** Tokens com cor sólida (#hex) — básico para color picker */
const CORE_COLOR_KEYS = [
  { key: 'bg', label: 'Fundo' },
  { key: 'bg-2', label: 'Fundo secundário' },
  { key: 'text', label: 'Texto' },
  { key: 'text-muted', label: 'Texto secundário' },
  { key: 'accent', label: 'Destaque (principal)' },
  { key: 'highlight', label: 'Destaque (ouro)' },
  { key: 'danger', label: 'Alerta' },
  { key: 'theme-color', label: 'Cor do tema (meta)' },
] as const

function normalizeHex(input: string): string {
  const t = input.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t}`
  return t
}

interface AdminAppearanceProps {
  empresaId: number
}

export function AdminAppearance({ empresaId }: AdminAppearanceProps) {
  const { isOwner } = useAuth()
  const { success, error } = useToast()
  const queryClient = useQueryClient()
  const [dark, setDark] = useState<Record<string, string>>({})
  const [light, setLight] = useState<Record<string, string>>({})
  const [platDark, setPlatDark] = useState<Record<string, string>>({})
  const [platLight, setPlatLight] = useState<Record<string, string>>({})
  const [savingEmpresa, setSavingEmpresa] = useState(false)
  const [savingPlat, setSavingPlat] = useState(false)

  const { data: empresaTema, isLoading: loadEmp } = useQuery({
    queryKey: ['empresa-tema', empresaId],
    queryFn: () => adminService.getEmpresaTema(empresaId),
  })

  const { data: platTema, isLoading: loadPlat } = useQuery({
    queryKey: ['plataforma-tema'],
    queryFn: () => adminService.getPlataformaTema(),
    enabled: isOwner,
  })

  useEffect(() => {
    if (!empresaTema) return
    setDark({ ...empresaTema.tokens_dark })
    setLight({ ...empresaTema.tokens_light })
  }, [empresaTema])

  useEffect(() => {
    if (!platTema) return
    setPlatDark({ ...platTema.tokens_dark })
    setPlatLight({ ...platTema.tokens_light })
  }, [platTema])

  const handleSaveEmpresa = async () => {
    setSavingEmpresa(true)
    try {
      await adminService.putEmpresaTema(empresaId, { tokens_dark: dark, tokens_light: light })
      await queryClient.invalidateQueries({ queryKey: ['empresa-tema', empresaId] })
      await queryClient.invalidateQueries({ queryKey: ['tema-ui'] })
      success('Tema da empresa salvo')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao salvar tema')
    } finally {
      setSavingEmpresa(false)
    }
  }

  const handleSavePlataforma = async () => {
    setSavingPlat(true)
    try {
      await adminService.putPlataformaTema({ tokens_dark: platDark, tokens_light: platLight })
      await queryClient.invalidateQueries({ queryKey: ['plataforma-tema'] })
      await queryClient.invalidateQueries({ queryKey: ['tema-ui'] })
      success('Tema da plataforma salvo')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao salvar tema da plataforma')
    } finally {
      setSavingPlat(false)
    }
  }

  const renderPickers = (
    mode: 'dark' | 'light',
    tokens: Record<string, string>,
    setTokens: Dispatch<SetStateAction<Record<string, string>>>,
  ) => (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {mode === 'dark' ? 'Modo escuro' : 'Modo claro'}
      </p>
      <div className="grid grid-cols-1 gap-3">
        {CORE_COLOR_KEYS.map(({ key, label }) => (
          <label key={`${mode}-${key}`} className="flex items-center gap-3">
            <span className="text-xs w-36 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <input
              type="color"
              value={normalizeHex(tokens[key] ?? '#000000').startsWith('#')
                ? normalizeHex(tokens[key] ?? '#000000').slice(0, 7)
                : '#000000'}
              onChange={(e) =>
                setTokens((prev) => ({
                  ...prev,
                  [key]: normalizeHex(e.target.value),
                }))
              }
              className="h-10 w-14 rounded-lg border-0 cursor-pointer bg-transparent"
              aria-label={`${label} (${mode})`}
            />
            <input
              type="text"
              value={tokens[key] ?? ''}
              onChange={(e) =>
                setTokens((prev) => ({
                  ...prev,
                  [key]: e.target.value,
                }))
              }
              className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-mono outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text)',
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )

  if (loadEmp) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
        Carregando tema…
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 space-y-6">
        <div>
          <p className="font-semibold text-sm">Aparência da empresa</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Cores principais aplicadas aos participantes desta empresa (tokens CSS).
          </p>
        </div>
        {renderPickers('dark', dark, setDark)}
        {renderPickers('light', light, setLight)}
        <button
          type="button"
          onClick={() => void handleSaveEmpresa()}
          disabled={savingEmpresa}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#070A12' }}
        >
          {savingEmpresa ? 'Salvando…' : 'Salvar tema da empresa'}
        </button>
      </div>

      {isOwner && (
        <div className="glass rounded-2xl p-5 space-y-6">
          <div>
            <p className="font-semibold text-sm">Tema padrão da plataforma</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Usado quando o usuário não tem empresa ou como base visual global.
            </p>
          </div>
          {loadPlat ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
          ) : (
            <>
              {renderPickers('dark', platDark, setPlatDark)}
              {renderPickers('light', platLight, setPlatLight)}
              <button
                type="button"
                onClick={() => void handleSavePlataforma()}
                disabled={savingPlat}
                className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                {savingPlat ? 'Salvando…' : 'Salvar tema da plataforma'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
