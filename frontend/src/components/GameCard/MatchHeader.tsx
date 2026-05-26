import { Lock, LockOpen } from 'lucide-react'
import { DeadlineCountdown } from '@/components/DeadlineCountdown'
import { MatchStatusBadge } from '@/components/MatchStatusBadge'
import { faseLabel, formatDate, jogoFaseJaMencionaRodada } from '@/lib/utils'
import type { Jogo } from '@/types'

type MatchStatus = 'done' | 'locked' | 'open'

interface MatchHeaderProps {
  jogo: Jogo
  todosJogos: Jogo[]
  status: MatchStatus
  showStatusBadge?: boolean
  palpiteRegistrado?: boolean
  palpiteEmEdicao?: boolean
  palpiteEncerrado?: boolean
}

function metaLinha(jogo: Jogo): string {
  const partes: string[] = []
  if (jogo.tipo_fase === 'grupos' && jogo.grupo) {
    partes.push(`Grupo ${jogo.grupo}`)
  }
  if (jogo.tipo_fase === 'grupos' && jogo.rodada && !jogoFaseJaMencionaRodada(jogo)) {
    partes.push(`Rodada ${jogo.rodada}`)
  }
  if (jogo.tipo_fase === 'mata_mata') {
    partes.push(faseLabel(jogo))
  }
  return partes.join(' · ')
}

export function MatchHeader({
  jogo,
  todosJogos,
  status,
  showStatusBadge = false,
  palpiteRegistrado = false,
  palpiteEmEdicao = false,
  palpiteEncerrado = false,
}: MatchHeaderProps) {
  const meta = metaLinha(jogo)

  return (
    <div
      className="px-4 pt-3 pb-2.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {meta && (
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {meta}
            </p>
          )}
          <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text)' }}>
            {formatDate(jogo.data_jogo)}
          </p>
          {status === 'open' && <DeadlineCountdown jogo={jogo} todosJogos={todosJogos} />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {palpiteRegistrado && (
            <span
              className="inline-flex items-center justify-center"
              title={
                palpiteEmEdicao
                  ? 'Editando palpite'
                  : palpiteEncerrado
                    ? 'Prazo encerrado'
                    : 'Palpite registrado'
              }
              aria-label={
                palpiteEmEdicao
                  ? 'Editando palpite'
                  : palpiteEncerrado
                    ? 'Prazo encerrado'
                    : 'Palpite registrado'
              }
            >
              {palpiteEmEdicao ? (
                <LockOpen size={15} style={{ color: 'var(--highlight)' }} />
              ) : (
                <Lock
                  size={15}
                  style={{ color: palpiteEncerrado ? 'var(--danger)' : 'var(--accent)' }}
                />
              )}
            </span>
          )}
          {showStatusBadge && <MatchStatusBadge status={status} />}
        </div>
      </div>
    </div>
  )
}
