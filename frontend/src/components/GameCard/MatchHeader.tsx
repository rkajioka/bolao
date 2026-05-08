import { Clock } from 'lucide-react'
import { MatchStatusBadge } from '@/components/MatchStatusBadge'
import { faseLabel, formatDate, deadlineText } from '@/lib/utils'
import type { Jogo } from '@/types'

type MatchStatus = 'done' | 'locked' | 'open'

interface MatchHeaderProps {
  jogo: Jogo
  todosJogos: Jogo[]
  status: MatchStatus
}

export function MatchHeader({ jogo, todosJogos, status }: MatchHeaderProps) {
  const rodadaLabel =
    jogo.tipo_fase === 'grupos' && jogo.rodada ? `Rodada ${jogo.rodada}` : null
  const deadline = status === 'open' ? deadlineText(jogo, todosJogos) : null

  return (
    <div
      className="flex items-center justify-between px-4 pt-3 pb-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <MatchStatusBadge status={status} />
      <div className="text-right">
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {faseLabel(jogo)}{rodadaLabel && ` · ${rodadaLabel}`}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
          {formatDate(jogo.data_jogo)}
        </p>
        {deadline && (
          <p
            className="text-xs mt-0.5 flex items-center justify-end gap-1"
            style={{ color: deadline.urgent ? 'var(--danger)' : 'var(--highlight)' }}
          >
            <Clock size={10} />
            {deadline.text}
          </p>
        )}
      </div>
    </div>
  )
}
