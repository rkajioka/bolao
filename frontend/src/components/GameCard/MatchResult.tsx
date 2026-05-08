import { Trophy } from 'lucide-react'
import type { Jogo } from '@/types'

interface MatchResultProps {
  jogo: Jogo
}

export function MatchResult({ jogo }: MatchResultProps) {
  if (jogo.placar_casa === null || jogo.placar_fora === null) return null

  return (
    <div
      className="mt-3 flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-medium flex-wrap"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Trophy size={12} style={{ color: 'var(--highlight)' }} />
      <span style={{ color: 'var(--text-muted)' }}>
        Resultado: {jogo.placar_casa} × {jogo.placar_fora}
      </span>
      {jogo.teve_prorrogacao && (
        <span
          className="px-1.5 py-0.5 rounded text-xs"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          Prorrogação
        </span>
      )}
      {jogo.foi_para_penaltis && jogo.penaltis_casa !== null && (
        <span
          className="px-1.5 py-0.5 rounded text-xs"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          Pênaltis {jogo.penaltis_casa}×{jogo.penaltis_fora}
        </span>
      )}
    </div>
  )
}
