import { CheckCircle2, CircleOff, Trophy } from 'lucide-react'
import { CountryFlag } from '@/components/CountryFlag'
import type { Jogo, MarcadorPalpite, PalpiteJogo } from '@/types'

interface FinishedMatchSummaryProps {
  jogo: Jogo
  palpite: PalpiteJogo | null
  marcadoresBrasilHabilitado?: boolean
  marcadoresSalvos?: Pick<MarcadorPalpite, 'nome_jogador' | 'quantidade_gols'>[]
}

function placarTexto(casa: number | null, fora: number | null) {
  if (casa === null || fora === null) return '–'
  return `${casa} × ${fora}`
}

function paisPorId(jogo: Jogo, id: number | null | undefined) {
  if (id == null) return null
  if (jogo.pais_casa.id === id) return jogo.pais_casa
  if (jogo.pais_fora.id === id) return jogo.pais_fora
  return null
}

function resultadoDoPlacar(casa: number, fora: number) {
  if (casa > fora) return 'casa'
  if (fora > casa) return 'fora'
  return 'empate'
}

function ScoreRow({
  label,
  casa,
  fora,
  jogo,
  tone = 'neutral',
}: {
  label: string
  casa: number | null
  fora: number | null
  jogo: Jogo
  tone?: 'neutral' | 'official' | 'exact' | 'result'
}) {
  const toneStyle =
    tone === 'official'
      ? { background: 'rgba(246,198,91,0.08)', border: '1px solid rgba(246,198,91,0.22)' }
      : tone === 'exact'
        ? { background: 'rgba(53,208,127,0.10)', border: '1px solid rgba(53,208,127,0.28)' }
        : tone === 'result'
          ? { background: 'rgba(53,208,127,0.06)', border: '1px solid rgba(53,208,127,0.18)' }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }

  return (
    <div className="rounded-xl p-3 space-y-2" style={toneStyle}>
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <CountryFlag pais={jogo.pais_casa} size="sm" />
          <span className="text-sm font-semibold truncate">{jogo.pais_casa.nome}</span>
        </div>
        <span className="text-xl font-black tabular-nums shrink-0" style={{ color: 'var(--text)' }}>
          {placarTexto(casa, fora)}
        </span>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="text-sm font-semibold truncate text-right">{jogo.pais_fora.nome}</span>
          <CountryFlag pais={jogo.pais_fora} size="sm" />
        </div>
      </div>
    </div>
  )
}

export function FinishedMatchSummary({
  jogo,
  palpite,
  marcadoresBrasilHabilitado = false,
  marcadoresSalvos = [],
}: FinishedMatchSummaryProps) {
  const oficialCasa = jogo.placar_casa
  const oficialFora = jogo.placar_fora
  const palpiteCasa = palpite?.palpite_casa ?? null
  const palpiteFora = palpite?.palpite_fora ?? null
  const temPalpite = palpiteCasa !== null && palpiteFora !== null

  const placarExato =
    temPalpite &&
    oficialCasa !== null &&
    oficialFora !== null &&
    palpiteCasa === oficialCasa &&
    palpiteFora === oficialFora

  const resultadoCorreto =
    temPalpite &&
    oficialCasa !== null &&
    oficialFora !== null &&
    resultadoDoPlacar(oficialCasa, oficialFora) === resultadoDoPlacar(palpiteCasa, palpiteFora)

  const classificadoOficial = paisPorId(jogo, jogo.classificado_id)
  const classificadoPalpite = paisPorId(jogo, palpite?.palpite_classificado_id)
  const classificadoCorreto =
    jogo.tipo_fase === 'mata_mata' &&
    jogo.classificado_id != null &&
    palpite?.palpite_classificado_id != null &&
    jogo.classificado_id === palpite.palpite_classificado_id

  const breakdown = palpite
    ? [
        { label: 'Placar exato', pts: palpite.pontuacao_placar },
        { label: 'Resultado correto', pts: palpite.pontuacao_resultado },
        ...(jogo.tipo_fase === 'mata_mata'
          ? [{ label: 'Classificado correto', pts: palpite.pontuacao_classificado }]
          : []),
        ...(marcadoresBrasilHabilitado
          ? [{ label: 'Marcadores do Brasil', pts: palpite.pontuacao_marcadores_brasil }]
          : []),
      ]
    : []

  const marcadoresValidos = marcadoresSalvos.filter((m) => m.nome_jogador.trim() && m.quantidade_gols > 0)

  return (
    <div className="space-y-3">
      <ScoreRow
        label="Resultado oficial"
        casa={oficialCasa}
        fora={oficialFora}
        jogo={jogo}
        tone="official"
      />

      {temPalpite ? (
        <ScoreRow
          label="Seu palpite"
          casa={palpiteCasa}
          fora={palpiteFora}
          jogo={jogo}
          tone={placarExato ? 'exact' : resultadoCorreto ? 'result' : 'neutral'}
        />
      ) : (
        <div
          className="rounded-xl px-3 py-3 flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <CircleOff size={14} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Você não enviou palpite para este jogo.
          </p>
        </div>
      )}

      {(jogo.teve_prorrogacao || jogo.foi_para_penaltis) && (
        <div className="flex flex-wrap gap-1.5">
          {jogo.teve_prorrogacao && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
            >
              Prorrogação
            </span>
          )}
          {jogo.foi_para_penaltis && jogo.penaltis_casa !== null && jogo.penaltis_fora !== null && (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}
            >
              Pênaltis {jogo.penaltis_casa}×{jogo.penaltis_fora}
            </span>
          )}
        </div>
      )}

      {jogo.tipo_fase === 'mata_mata' && (classificadoOficial || classificadoPalpite) && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Classificado
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Oficial</p>
              {classificadoOficial ? (
                <div className="flex items-center gap-2">
                  <CountryFlag pais={classificadoOficial} size="sm" />
                  <span className="text-sm font-semibold truncate">{classificadoOficial.nome}</span>
                </div>
              ) : (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>–</span>
              )}
            </div>
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: classificadoCorreto ? 'rgba(53,208,127,0.08)' : 'rgba(255,255,255,0.03)',
                border: classificadoCorreto ? '1px solid rgba(53,208,127,0.22)' : '1px solid transparent',
              }}
            >
              <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Seu palpite</p>
              {classificadoPalpite ? (
                <div className="flex items-center gap-2">
                  <CountryFlag pais={classificadoPalpite} size="sm" />
                  <span className="text-sm font-semibold truncate">{classificadoPalpite.nome}</span>
                  {classificadoCorreto && <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />}
                </div>
              ) : (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Não informado</span>
              )}
            </div>
          </div>
        </div>
      )}

      {marcadoresValidos.length > 0 && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Seus marcadores do Brasil
          </p>
          <div className="flex flex-wrap gap-1.5">
            {marcadoresValidos.map((marcador) => (
              <span
                key={`${marcador.nome_jogador}-${marcador.quantidade_gols}`}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {marcador.nome_jogador} · {marcador.quantidade_gols} gol{marcador.quantidade_gols === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </div>
      )}

      {palpite && (
        <div
          className="rounded-xl p-3 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color: 'var(--highlight)' }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--highlight)' }}>
                Sua pontuação
              </p>
            </div>
            <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--accent)' }}>
              {palpite.pontuacao_total}
              <span className="text-sm font-semibold ml-1" style={{ color: 'var(--text-muted)' }}>pts</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {breakdown.map(({ label, pts }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2"
                style={{
                  background: pts > 0 ? 'rgba(53,208,127,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${pts > 0 ? 'rgba(53,208,127,0.22)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-lg font-black tabular-nums mt-0.5" style={{ color: pts > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {pts}
                </p>
              </div>
            ))}
          </div>

          {palpite.pontuacao_total === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Nenhum critério de pontuação foi atingido neste jogo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
