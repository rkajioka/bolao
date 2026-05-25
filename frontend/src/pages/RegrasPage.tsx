import { useQuery } from '@tanstack/react-query'
import { SectionHeader } from '@/components/SectionHeader'
import { Clock, Trophy, Star, Zap, CheckCircle, ChevronRight } from 'lucide-react'
import { subduedSurfaceStyle, toneChipStyle, toneSurfaceStyle, type ThemeTone } from '@/lib/fieldStyles'
import { formatDate } from '@/lib/utils'
import { regrasService } from '@/services/regras.service'

const FASES_SEM_PONTOS_CLASSIFICADO = new Set([
  'grupo_rodada_1',
  'grupo_rodada_2',
  'grupo_rodada_3',
])

function SectionTitle({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode
  label: string
  tone: ThemeTone
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={toneChipStyle(tone)}
      >
        {icon}
      </div>
      <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
        {label}
      </p>
    </div>
  )
}

export function RegrasPage() {
  const { data: config, isLoading: loadCfg, isError: errCfg, refetch: refetchCfg } = useQuery({
    queryKey: ['configuracao-bolao', 'minha'],
    queryFn: () => regrasService.getConfigMinha(),
    staleTime: Infinity,
  })

  const { data: fases = [], isLoading: loadFases, isError: errFases, refetch: refetchFases } = useQuery({
    queryKey: ['configuracao-pontuacao-fase', 'minha'],
    queryFn: () => regrasService.getFasesMinha(),
    staleTime: Infinity,
  })

  const fasesSorted = [...fases].sort((a, b) => a.ordem - b.ordem)

  const primeiraFase = fasesSorted[0]

  return (
    <div className="space-y-3">
      <SectionHeader title="Regras" subtitle="Como funciona o bolão e a pontuação" />

      {(loadCfg || loadFases) && (
        <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>Carregando regras…</p>
      )}

      {(errCfg || errFases) && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            Não foi possível carregar todas as regras.
          </p>
          <button
            type="button"
            onClick={() => {
              if (errCfg) void refetchCfg()
              if (errFases) void refetchFases()
            }}
            className="text-xs font-semibold px-2 py-1 rounded-lg"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Clock size={14} />} label="Fechamento" tone="danger" />
        <div className="space-y-2">
          {[
            {
              title: '1h antes do 1º jogo',
              description: 'Cada rodada/fase fecha 1 hora antes do primeiro jogo daquele bloco.',
            },
            {
              title: 'Palpites especiais',
              description: config?.data_bloqueio_palpites_especiais
                ? `Fechamento configurado: ${formatDate(config.data_bloqueio_palpites_especiais)}`
                : 'Fecham automaticamente 1 hora antes do primeiro jogo da Copa (horário de Brasília), salvo outra data definida pelo administrador.',
            },
          ].map(({ title, description }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-xl p-3"
              style={toneSurfaceStyle('danger')}
            >
              <ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Trophy size={14} />} label="Pontuação por fase" tone="highlight" />

        <div className="flex gap-2 mb-4">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={toneSurfaceStyle('highlight')}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap size={12} style={{ color: 'var(--highlight)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Placar exato</p>
            </div>
            <p className="text-xl font-black tabular-nums" style={{ color: 'var(--text)' }}>
              +{primeiraFase?.pontos_placar_exato ?? '—'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {primeiraFase ? `na fase: ${primeiraFase.label}` : 'valores do bolão'}
            </p>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center" style={toneSurfaceStyle('accent')}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle size={12} style={{ color: 'var(--accent)' }} />
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Resultado</p>
            </div>
            <p className="text-xl font-black tabular-nums" style={{ color: 'var(--text)' }}>
              +{primeiraFase?.pontos_resultado_correto ?? '—'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {primeiraFase ? `na fase: ${primeiraFase.label}` : 'valores do bolão'}
            </p>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div
            className="grid grid-cols-4 px-3 py-2"
            style={{ background: 'var(--segmented-bg)', borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Fase</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--text-muted)' }}>Exato</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--text-muted)' }}>Result.</span>
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
                  borderBottom: i < fasesSorted.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 0 ? 'transparent' : 'var(--segmented-bg)',
                }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{row.label}</span>
                <span className="text-sm font-black text-center tabular-nums" style={{ color: 'var(--text)' }}>{row.pontos_placar_exato}</span>
                <span className="text-sm font-black text-center tabular-nums" style={{ color: 'var(--text)' }}>{row.pontos_resultado_correto}</span>
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

      <div className="glass rounded-2xl p-4">
        <SectionTitle icon={<Star size={14} />} label="Palpites especiais" tone="accent" />
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
              style={subduedSurfaceStyle}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
              <div className="flex items-center gap-1">
                <span className="text-lg font-black tabular-nums" style={{ color: 'var(--text)' }}>
                  {pts ?? '—'}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3 px-1" style={{ color: 'var(--text-muted)' }}>
          Os valores seguem a configuração do bolão. Palpites especiais podem ter data de bloqueio própria.
        </p>
      </div>

      {config?.marcadores_brasil_habilitado ? (
        <div className="glass rounded-2xl p-4">
          <SectionTitle icon={<span style={{ fontSize: '14px', lineHeight: 1 }}>🇧🇷</span>} label="Bônus Brasil" tone="accent" />
          <div className="rounded-xl p-3 space-y-2" style={toneSurfaceStyle('accent')}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Marcadores da Seleção</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Nos jogos do Brasil, você pode palpitar quais jogadores marcarão gols. Acertos rendem bônus extras de pontos.
              Os nomes disponíveis são definidos por uma lista de candidatos cadastrada no sistema.
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Pontos por marcador (configuração atual):{' '}
              <strong style={{ color: 'var(--text)' }}>{config.pontos_marcador_brasil}</strong>
              {' '}· com quantidade de gols:{' '}
              <strong style={{ color: 'var(--text)' }}>{config.pontos_marcador_brasil_com_quantidade}</strong>
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
