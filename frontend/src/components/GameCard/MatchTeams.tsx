import { CountryFlag } from '@/components/CountryFlag'
import { ScoreStepper } from '@/components/ScoreStepper'
import { nomeSelecaoParaCard } from '@/lib/utils'
import type { Jogo } from '@/types'

interface MatchTeamsProps {
  jogo: Jogo
  casa: number | null
  fora: number | null
  bloqueado: boolean
  onCasaChange: (v: number | null) => void
  onForaChange: (v: number | null) => void
}

export function MatchTeams({ jogo, casa, fora, bloqueado, onCasaChange, onForaChange }: MatchTeamsProps) {
  const nomeCasa = nomeSelecaoParaCard(jogo.pais_casa.nome, jogo.pais_casa.sigla)
  const nomeFora = nomeSelecaoParaCard(jogo.pais_fora.nome, jogo.pais_fora.sigla)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <CountryFlag pais={jogo.pais_casa} size="md" />
        <span
          className="font-semibold text-sm leading-tight line-clamp-2"
          title={jogo.pais_casa.nome}
          style={{ color: 'var(--text)' }}
        >
          {nomeCasa}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <ScoreStepper
          value={casa}
          onChange={onCasaChange}
          disabled={bloqueado}
          readOnly={bloqueado}
          label={`Palpite ${jogo.pais_casa.nome}`}
        />
        <span className="mx-0.5 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
          ×
        </span>
        <ScoreStepper
          value={fora}
          onChange={onForaChange}
          disabled={bloqueado}
          readOnly={bloqueado}
          label={`Palpite ${jogo.pais_fora.nome}`}
        />
      </div>

      <div className="flex items-center gap-2 min-w-0 justify-end">
        <span
          className="font-semibold text-sm leading-tight line-clamp-2 text-right"
          title={jogo.pais_fora.nome}
          style={{ color: 'var(--text)' }}
        >
          {nomeFora}
        </span>
        <CountryFlag pais={jogo.pais_fora} size="md" />
      </div>
    </div>
  )
}
