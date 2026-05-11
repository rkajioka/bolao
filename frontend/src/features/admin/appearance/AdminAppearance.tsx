import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { adminService } from '@/services/admin.service'
import { useToast } from '@/components/Toast'

const DEFAULT_BRAND = {
  dark: { accent: '#35D07F', highlight: '#D4A017' },
  light: { accent: '#1DB864', highlight: '#B8860B' },
} as const

const DIM_ALPHA = { dark: 0.15, light: 0.12 } as const

function normalizeHex(input: string): string {
  const t = input.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t}`
  return t
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  const match = /^#([0-9A-Fa-f]{6})$/.exec(normalized)
  if (!match) return null
  return {
    r: parseInt(match[1].slice(0, 2), 16),
    g: parseInt(match[1].slice(2, 4), 16),
    b: parseInt(match[1].slice(4, 6), 16),
  }
}

function dimFromHex(hex: string, alpha: number): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function applyBrandColor(
  tokens: Record<string, string>,
  key: 'accent' | 'highlight',
  hex: string,
  alpha: number,
): Record<string, string> {
  const dimKey = key === 'accent' ? 'accent-dim' : 'highlight-dim'
  const dim = dimFromHex(hex, alpha)
  return {
    ...tokens,
    [key]: normalizeHex(hex),
    ...(dim ? { [dimKey]: dim } : {}),
  }
}

function patchBrandColors(
  dark: Record<string, string>,
  light: Record<string, string>,
  accent: string,
  highlight: string,
) {
  return {
    dark: applyBrandColor(
      applyBrandColor(dark, 'accent', accent, DIM_ALPHA.dark),
      'highlight',
      highlight,
      DIM_ALPHA.dark,
    ),
    light: applyBrandColor(
      applyBrandColor(light, 'accent', accent, DIM_ALPHA.light),
      'highlight',
      highlight,
      DIM_ALPHA.light,
    ),
  }
}

interface BrandColorsEditorProps {
  title: string
  description: string
  dark: Record<string, string>
  light: Record<string, string>
  onChange: (next: { dark: Record<string, string>; light: Record<string, string> }) => void
  onSave: () => void | Promise<void>
  saving: boolean
  saveLabel: string
}

function BrandColorsEditor({
  title,
  description,
  dark,
  light,
  onChange,
  onSave,
  saving,
  saveLabel,
}: BrandColorsEditorProps) {
  const accent = normalizeHex(dark.accent ?? DEFAULT_BRAND.dark.accent)
  const highlight = normalizeHex(dark.highlight ?? DEFAULT_BRAND.dark.highlight)

  const updateColors = (nextAccent: string, nextHighlight: string) => {
    onChange(patchBrandColors(dark, light, nextAccent, nextHighlight))
  }

  const restoreDefaults = () => {
    onChange({
      dark: applyBrandColor(
        applyBrandColor(dark, 'accent', DEFAULT_BRAND.dark.accent, DIM_ALPHA.dark),
        'highlight',
        DEFAULT_BRAND.dark.highlight,
        DIM_ALPHA.dark,
      ),
      light: applyBrandColor(
        applyBrandColor(light, 'accent', DEFAULT_BRAND.light.accent, DIM_ALPHA.light),
        'highlight',
        DEFAULT_BRAND.light.highlight,
        DIM_ALPHA.light,
      ),
    })
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <input
            type="color"
            value={accent}
            onChange={(e) => updateColors(normalizeHex(e.target.value), highlight)}
            className="h-11 w-11 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
            aria-label="Cor principal"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Cor principal</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Botões, destaques e navegação ativa
            </p>
          </div>
        </label>

        <label
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <input
            type="color"
            value={highlight}
            onChange={(e) => updateColors(accent, normalizeHex(e.target.value))}
            className="h-11 w-11 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
            aria-label="Cor de destaque"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">Cor de destaque</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Pódio, medalhas e recompensas
            </p>
          </div>
        </label>
      </div>

      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Prévia
        </span>
        <span
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: dimFromHex(accent, DIM_ALPHA.dark) ?? 'var(--accent-dim)', color: accent }}
        >
          Principal
        </span>
        <span
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: dimFromHex(highlight, DIM_ALPHA.dark) ?? 'var(--highlight-dim)', color: highlight }}
        >
          Destaque
        </span>
        <button
          type="button"
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: accent, color: '#070A12' }}
        >
          Ação
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={restoreDefaults}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
        >
          Restaurar padrão
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#070A12' }}
        >
          {saving ? 'Salvando…' : saveLabel}
        </button>
      </div>
    </div>
  )
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
      success('Cores da empresa salvas')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao salvar cores da empresa')
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
      success('Cores padrão da plataforma salvas')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Erro ao salvar cores da plataforma')
    } finally {
      setSavingPlat(false)
    }
  }

  if (loadEmp) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
        Carregando aparência…
      </p>
    )
  }

  const empresaEditor = (
    <BrandColorsEditor
      title={isOwner ? 'Cores do bolão da empresa' : 'Cores do bolão'}
      description={
        isOwner
          ? 'Vale para todos os participantes da empresa selecionada acima. A sua conta de proprietário mantém o visual padrão da plataforma.'
          : 'Vale para todos os participantes da sua empresa assim que eles entrarem no bolão.'
      }
      dark={dark}
      light={light}
      onChange={({ dark: nextDark, light: nextLight }) => {
        setDark(nextDark)
        setLight(nextLight)
      }}
      onSave={handleSaveEmpresa}
      saving={savingEmpresa}
      saveLabel="Salvar cores da empresa"
    />
  )

  const plataformaEditor = loadPlat ? (
    <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
      Carregando visual da plataforma…
    </p>
  ) : (
    <BrandColorsEditor
      title="Visual padrão da plataforma"
      description="Usado na sua conta de proprietário e como base quando não há tema da empresa."
      dark={platDark}
      light={platLight}
      onChange={({ dark: nextDark, light: nextLight }) => {
        setPlatDark(nextDark)
        setPlatLight(nextLight)
      }}
      onSave={handleSavePlataforma}
      saving={savingPlat}
      saveLabel="Salvar visual da plataforma"
    />
  )

  return (
    <div className="space-y-4">
      {isOwner ? (
        <>
          {plataformaEditor}
          {empresaEditor}
        </>
      ) : (
        empresaEditor
      )}
    </div>
  )
}
