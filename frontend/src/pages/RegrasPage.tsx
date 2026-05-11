import { useQuery } from '@tanstack/react-query'
import { SectionHeader } from '@/components/SectionHeader'
import { Clock, Trophy, Star, Zap, CheckCircle, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { regrasService } from '@/services/regras.service'

const FASES_SEM_PONTOS_CLASSIFICADO = new Set([
  'grupo_rodada_1',
  'grupo_rodada_2',
  'grupo_rodada_3',
])

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
  const { data: config, isLoading: loadCfg, isError: errCfg } = useQuery({
    queryKey: ['configuracao-bolao', 'minha'],
    queryFn: () => regrasService.getConfigMinha(),
  })

  const { data: fases = [], isLoading: loadFases, isError: errFases } = useQuery({
    queryKey: ['configuracao-pontuacao-fase', 'minha'],
    queryFn: () => regrasService.getFasesMinha(),
  })

  const fasesSorted = [...fases].sort((a, b) => a.ordem - b.ordem)

  const primeiraFase = fasesSorted[0]

  return (
    <div className="space-y-3">
      <SectionHeader title="Regras" subtitle="Como funciona o bolão e a pontuação" />

      {(loadCfg || loadFases) && (
        <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>Carregando regras da sua empresa…</p>
      )}

      {(errCfg || errFases) && (
        <p className="text-xs px-1" style={{ color: 'var(--danger)' }}>
          Não foi possível carregar todas as regras. Verifique se você está vinculado a uma empresa.
        </p>
      )}

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
                {config?.data_bloqueio_palpites_especiais
                  ? `Fechamento configurado: ${formatDate(config.data_bloqueio_palpites_especiais)}`
                  : 'Fecham automaticamente 1 hora antes do primeiro jogo da Copa (horário de Brasília), salvo outra data definida pelo administrador.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pontuação por resultado */}
      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Trophy size={14} />} label="Pontuação por fase" color="var(--highlight)" />

        <div className="flex gap-2 mb-4">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(212,160,23,0.10)', border: '1px solid rgba(212,160,23,0.20)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap size={12} style={{ color: 'var(--highlight)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--highlight)' }}>Placar exato</p>
            </div>
            <p className="text-xl font-black" style={{ color: 'var(--highlight)' }}>
              +{primeiraFase?.pontos_placar_exato ?? '—'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {primeiraFase ? `na fase: ${primeiraFase.label}` : 'valores da sua empresa'}
            </p>
          </div>
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: 'rgba(53,208,127,0.08)', border: '1px solid rgba(53,208,127,0.18)' }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle size={12} style={{ color: 'var(--accent)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--accent)' }}>Resultado</p>
            </div>
            <p className="text-xl font-black" style={{ color: 'var(--accent)' }}>
              +{primeiraFase?.pontos_resultado_correto ?? '—'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {primeiraFase ? `na fase: ${primeiraFase.label}` : 'valores da sua empresa'}
            </p>
          </div>
        </div>

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
          {fasesSorted.length === 0 && !loadFases ? (
            <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Nenhuma fase configurada.
            </div>
          ) : (
            fasesSorted.map((row, i) => (
              <div
                key={row.fase_key}
                className="grid grid-cols-4 px-3 py-2.5 items-center"
                style={{
                  borderBottom: i < fasesSorted.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{row.label}</span>
                <span className="text-sm font-black text-center tabular-nums" style={{ color: 'var(--highlight)' }}>{row.pontos_placar_exato}</span>
                <span className="text-sm font-black text-center tabular-nums" style={{ color: 'var(--accent)' }}>{row.pontos_resultado_correto}</span>
                <span className="text-sm font-semibold text-center tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {FASES_SEM_PONTOS_CLASSIFICADO.has(row.fase_key) ? '-' : row.pontos_classificado_mata_mata}
                </span>
              </div>
            ))
          )}
        </div>

        <p className="text-xs mt-3 px-1" style={{ color: 'var(--text-muted)' }}>
          Em mata-mata há bônus pelo classificado acertado, além do placar.
        </p>
      </div>

      {/* Palpites especiais */}
      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Star size={14} />} label="Palpites especiais" color="var(--accent)" />
        <div className="space-y-2">
          {[
            { label: 'Campeão', pts: config?.pontos_campeao },
            { label: 'Vice-campeão', pts: config?.pontos_vice_campeao },
            { label: '3º lugar', pts: config?.pontos_terceiro_lugar },
            { label: 'País do artilheiro', pts: config?.pontos_artilheiro_pais },
          ].map(({ label, pts }) => (
            <div
              key={label}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-black tabular-nums" style={{ color: 'var(--accent)' }}>
                  {pts ?? '—'}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3 px-1" style={{ color: 'var(--text-muted)' }}>
          Os valores seguem a configuração do bolão da sua empresa. Palpites especiais podem ter data de bloqueio própria.
        </p>
      </div>

      {config?.marcadores_brasil_habilitado ? (
      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<span style={{ fontSize: '14px', lineHeight: 1 }}>🇧🇷</span>} label="Bônus Brasil" color="var(--accent)" />
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: 'rgba(53,208,127,0.06)', border: '1px solid rgba(53,208,127,0.15)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Marcadores da Seleção</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Nos jogos do Brasil, você pode palpitar quais jogadores marcarão gols. Acertos rendem bônus extras de pontos.
            Os nomes disponíveis são definidos por uma lista de candidatos cadastrada no sistema.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Pontos por marcador (configuração atual):{' '}
            <strong style={{ color: 'var(--accent)' }}>{config.pontos_marcador_brasil}</strong>
            {' '}· com quantidade de gols:{' '}
            <strong style={{ color: 'var(--accent)' }}>{config.pontos_marcador_brasil_com_quantidade}</strong>
          </p>
        </div>
      </div>
      ) : (
        config && (
          <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
            Seu bolão não usa bônus por marcadores do Brasil.
          </p>
        )
      )}
    </div>
  )
}
