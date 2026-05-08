import { CountryFlag } from '@/components/CountryFlag'
import type { Jogo } from '@/types'

interface KnockoutSectionProps {
  jogo: Jogo
  classificado: number | null
  bloqueado: boolean
  onClassificadoChange: (id: number) => void
}

export function KnockoutSection({ jogo, classificado, bloqueado, onClassificadoChange }: KnockoutSectionProps) {
  if (jogo.tipo_fase !== 'mata_mata') return null

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
        Quem se classifica?
      </label>
      <div className="flex gap-2" role="group" aria-label="Selecione o classificado">
        {[jogo.pais_casa, jogo.pais_fora].map((pais) => (
          <button
            key={pais.id}
            type="button"
            disabled={bloqueado}
            onClick={() => onClassificadoChange(pais.id)}
            aria-pressed={classificado === pais.id}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
            style={{
              background: classificado === pais.id
                ? 'rgba(53,208,127,0.15)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${classificado === pais.id
                ? 'rgba(53,208,127,0.4)'
                : 'rgba(255,255,255,0.08)'}`,
              color: classificado === pais.id ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <CountryFlag pais={pais} size="sm" />
            {pais.nome}
          </button>
        ))}
      </div>
    </div>
  )
}
