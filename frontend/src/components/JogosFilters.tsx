import { SegmentedControl } from '@/components/SegmentedControl'
import { SelectInput } from '@/components/SelectInput'
import type { PalpiteSegmentOption } from '@/lib/utils'

export type JogosTab = 'cronologico' | 'grupos'
export type JogosStatusFiltro = 'abertos' | 'meus_palpites' | 'fechados'

const STATUS_SEGMENTS = [
  { key: 'abertos' as JogosStatusFiltro, label: 'Em aberto' },
  { key: 'meus_palpites' as JogosStatusFiltro, label: 'Meus palpites' },
  { key: 'fechados' as JogosStatusFiltro, label: 'Fechados' },
]

const TAB_OPTIONS = [
  { key: 'cronologico' as JogosTab, label: 'Cronológico' },
  { key: 'grupos' as JogosTab, label: 'Por grupo' },
]

interface JogosFiltersProps {
  tab: JogosTab
  onTabChange: (tab: JogosTab) => void
  filtroStatus: JogosStatusFiltro
  onFiltroStatusChange: (status: JogosStatusFiltro) => void
  segmentos: PalpiteSegmentOption[]
  segmentoAtivo: string
  onSegmentoChange: (key: string) => void
  gruposDisponiveis?: string[]
  grupoSelecionado?: string
  onGrupoChange?: (grupo: string) => void
}

export function JogosFilters({
  tab,
  onTabChange,
  filtroStatus,
  onFiltroStatusChange,
  segmentos,
  segmentoAtivo,
  onSegmentoChange,
  gruposDisponiveis = [],
  grupoSelecionado = '',
  onGrupoChange,
}: JogosFiltersProps) {
  const segmentoOptions = segmentos.map((segmento) => ({
    value: segmento.key,
    label: segmento.label,
  }))

  const grupoOptions = gruposDisponiveis.map((grupo) => ({
    value: grupo,
    label: `Grupo ${grupo}`,
  }))

  return (
    <div
      className="space-y-2 rounded-2xl px-3 py-2.5"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
      }}
    >
      <SegmentedControl
        segments={STATUS_SEGMENTS}
        value={filtroStatus}
        onChange={onFiltroStatusChange}
        controlId="jogos-status"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          {TAB_OPTIONS.map((option) => {
            const active = tab === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onTabChange(option.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: active ? 'var(--segmented-active-bg)' : 'transparent',
                  border: active ? '1px solid var(--segmented-active-border)' : '1px solid transparent',
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>

        {segmentoOptions.length > 1 && (
          <div className="min-w-[9.5rem] flex-1">
            <SelectInput
              value={segmentoAtivo}
              onChange={onSegmentoChange}
              options={segmentoOptions}
              placeholder="Rodada / fase"
              className="text-xs"
            />
          </div>
        )}

        {tab === 'grupos' && grupoOptions.length > 0 && onGrupoChange && (
          <div className="min-w-[8.5rem] flex-1">
            <SelectInput
              value={grupoSelecionado}
              onChange={onGrupoChange}
              options={grupoOptions}
              placeholder="Grupo"
              className="text-xs"
            />
          </div>
        )}
      </div>
    </div>
  )
}
