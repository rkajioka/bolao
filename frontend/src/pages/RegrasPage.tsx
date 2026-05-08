import { SectionHeader } from '@/components/SectionHeader'
import { Clock, Trophy, Star, Zap, CheckCircle, ChevronRight } from 'lucide-react'

interface ScoringRow {
  fase: string
  exato: number
  resultado: number
  classificado?: number
}

const SCORING: ScoringRow[] = [
  { fase: 'Grupos', exato: 10, resultado: 5 },
  { fase: '32-avos', exato: 12, resultado: 6, classificado: 6 },
  { fase: '16-avos', exato: 14, resultado: 7, classificado: 7 },
  { fase: 'Oitavas', exato: 15, resultado: 7, classificado: 7 },
  { fase: 'Quartas', exato: 16, resultado: 8, classificado: 8 },
  { fase: 'Semifinal', exato: 18, resultado: 9, classificado: 9 },
  { fase: '3º lugar', exato: 20, resultado: 10, classificado: 10 },
  { fase: 'Final', exato: 24, resultado: 12, classificado: 12 },
]

const ESPECIAIS = [
  { label: 'Campeão', pts: 35 },
  { label: 'Vice-campeão', pts: 25 },
  { label: '3º lugar', pts: 20 },
  { label: 'País do artilheiro', pts: 20 },
]

function SectionTitle({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}1A`, color }}
      >
        {icon}
      </div>
      <p className="text-sm font-bold" style={{ color }}>
        {label}
      </p>
    </div>
  )
}

export function RegrasPage() {
  return (
    <div className="space-y-3">
      <SectionHeader title="Regras" subtitle="Como funciona o bolão e a pontuação" />

      {/* Fechamento */}
      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Clock size={14} />} label="Fechamento" color="var(--danger)" />
        <div className="space-y-2">
          <div
            className="flex items-start gap-3 rounded-xl p-3"
            style={{ background: 'rgba(255,92,122,0.06)', border: '1px solid rgba(255,92,122,0.15)' }}
          >
            <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>1h antes do 1º jogo</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Cada rodada/fase fecha 1 hora antes do primeiro jogo daquele bloco.
              </p>
            </div>
          </div>
          <div
            className="flex items-start gap-3 rounded-xl p-3"
            style={{ background: 'rgba(255,92,122,0.06)', border: '1px solid rgba(255,92,122,0.15)' }}
          >
            <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Palpites especiais</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Fecham 1 hora antes do primeiro jogo da Copa (horário de Brasília).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pontuação por resultado */}
      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Trophy size={14} />} label="Pontuação por fase" color="var(--highlight)" />

        {/* Mini exemplo visual */}
        <div className="flex gap-2 mb-4">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(212,160,23,0.10)', border: '1px solid rgba(212,160,23,0.20)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap size={12} style={{ color: 'var(--highlight)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--highlight)' }}>Placar exato</p>
            </div>
            <p className="text-xl font-black" style={{ color: 'var(--highlight)' }}>+10</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>na fase de grupos</p>
          </div>
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(53,208,127,0.08)', border: '1px solid rgba(53,208,127,0.18)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle size={12} style={{ color: 'var(--accent)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>Resultado</p>
            </div>
            <p className="text-xl font-black" style={{ color: 'var(--accent)' }}>+5</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>na fase de grupos</p>
          </div>
        </div>

        {/* Tabela de fases */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div
            className="grid grid-cols-4 px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fase</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--highlight)' }}>Exato</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--accent)' }}>Result.</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--text-muted)' }}>Class.</span>
          </div>
          {SCORING.map((row, i) => (
            <div
              key={row.fase}
              className="grid grid-cols-4 px-3 py-2.5 items-center"
              style={{
                borderBottom: i < SCORING.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{row.fase}</span>
              <span className="text-sm font-black text-center tabular-nums" style={{ color: 'var(--highlight)' }}>{row.exato}</span>
              <span className="text-sm font-black text-center tabular-nums" style={{ color: 'var(--accent)' }}>{row.resultado}</span>
              <span className="text-sm font-semibold text-center tabular-nums" style={{ color: row.classificado ? 'var(--text-muted)' : 'transparent' }}>
                {row.classificado ?? '—'}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs mt-3 px-1" style={{ color: 'var(--text-muted)' }}>
          Em mata-mata há bônus pelo classificado acertado, além do placar.
        </p>
      </div>

      {/* Palpites especiais */}
      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Star size={14} />} label="Palpites especiais" color="var(--accent)" />
        <div className="space-y-2">
          {ESPECIAIS.map(({ label, pts }) => (
            <div
              key={label}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-black tabular-nums" style={{ color: 'var(--accent)' }}>{pts}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3 px-1" style={{ color: 'var(--text-muted)' }}>
          Palpites especiais podem ser bloqueados pelo admin. Verifique a aba Especiais.
        </p>
      </div>

      {/* Bônus Brasil */}
      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<span style={{ fontSize: '14px', lineHeight: 1 }}>🇧🇷</span>} label="Bônus Brasil" color="var(--accent)" />
        <div
          className="rounded-xl p-3"
          style={{ background: 'rgba(53,208,127,0.06)', border: '1px solid rgba(53,208,127,0.15)' }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Marcadores da Seleção</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Nos jogos do Brasil, você pode palpitar quais jogadores marcarão gols. Acertos rendem bônus extras de pontos.
            Os nomes disponíveis são definidos por uma lista de candidatos cadastrada no sistema.
          </p>
        </div>
      </div>
    </div>
  )
}
