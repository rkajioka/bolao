import { CountryFlag } from '@/components/CountryFlag'
import { ScoreStepper } from '@/components/ScoreStepper'
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
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <CountryFlag pais={jogo.pais_casa} size="md" />
        <span className="font-semibold text-sm truncate">{jogo.pais_casa.nome}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <ScoreStepper
          value={casa}
          onChange={onCasaChange}
          disabled={bloqueado}
          readOnly={bloqueado}
          label={`Palpite ${jogo.pais_casa.nome}`}
        />
        <span className="mx-1 text-base font-bold" style={{ color: 'var(--text-muted)' }}>×</span>
        <ScoreStepper
          value={fora}
          onChange={onForaChange}
          disabled={bloqueado}
          readOnly={bloqueado}
          label={`Palpite ${jogo.pais_fora.nome}`}
        />
      </div>

      <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
        <span className="font-semibold text-sm truncate text-right">{jogo.pais_fora.nome}</span>
        <CountryFlag pais={jogo.pais_fora} size="md" />
      </div>
    </div>
  )
}
