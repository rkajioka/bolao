import { CheckCircle2, CircleOff } from 'lucide-react'
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

function scoreCellStyle(tone: 'official' | 'exact' | 'result' | 'neutral') {
  if (tone === 'official') {
    return { background: 'var(--highlight-dim)', border: '1px solid var(--border)' }
  }
  if (tone === 'exact') {
    return { background: 'var(--accent-dim)', border: '1px solid var(--border)' }
  }
  if (tone === 'result') {
    return { background: 'var(--accent-dim)', border: '1px solid var(--border)' }
  }
  return { background: 'var(--segmented-bg)', border: '1px solid var(--border)' }
}

function ScoreCell({
  label,
  casa,
  fora,
  tone,
}: {
  label: string
  casa: number | null
  fora: number | null
  tone: 'official' | 'exact' | 'result' | 'neutral'
}) {
  return (
    <div className="rounded-lg px-2.5 py-2 text-center" style={scoreCellStyle(tone)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-lg font-black tabular-nums mt-0.5" style={{ color: 'var(--text)' }}>
        {placarTexto(casa, fora)}
      </p>
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
        { label: 'Exato', pts: palpite.pontuacao_placar },
        { label: 'Resultado', pts: palpite.pontuacao_resultado },
        ...(jogo.tipo_fase === 'mata_mata'
          ? [{ label: 'Classif.', pts: palpite.pontuacao_classificado }]
          : []),
        ...(marcadoresBrasilHabilitado
          ? [{ label: 'Marcadores', pts: palpite.pontuacao_marcadores_brasil }]
          : []),
      ]
    : []

  const breakdownComPontos = breakdown.filter(({ pts }) => pts > 0)
  const marcadoresValidos = marcadoresSalvos.filter((m) => m.nome_jogador.trim() && m.quantidade_gols > 0)

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl p-2.5 space-y-2"
        style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <CountryFlag pais={jogo.pais_casa} size="sm" />
            <span className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
              {jogo.pais_casa.nome}
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
            vs
          </span>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
            <span className="text-xs font-semibold truncate text-right" style={{ color: 'var(--text)' }}>
              {jogo.pais_fora.nome}
            </span>
            <CountryFlag pais={jogo.pais_fora} size="sm" />
          </div>
        </div>

        <div className={`grid gap-2 ${temPalpite ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <ScoreCell label="Oficial" casa={oficialCasa} fora={oficialFora} tone="official" />
          {temPalpite ? (
            <ScoreCell
              label="Seu palpite"
              casa={palpiteCasa}
              fora={palpiteFora}
              tone={placarExato ? 'exact' : resultadoCorreto ? 'result' : 'neutral'}
            />
          ) : null}
        </div>
      </div>

      {!temPalpite && (
        <div
          className="rounded-xl px-3 py-2 flex items-center gap-2"
          style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}
        >
          <CircleOff size={14} style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Você não enviou palpite para este jogo.
          </p>
        </div>
      )}

      {(jogo.teve_prorrogacao || jogo.foi_para_penaltis) && (
        <div className="flex flex-wrap gap-1.5">
          {jogo.teve_prorrogacao && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: 'var(--segmented-bg)', color: 'var(--text-muted)' }}
            >
              Prorrogação
            </span>
          )}
          {jogo.foi_para_penaltis && jogo.penaltis_casa !== null && jogo.penaltis_fora !== null && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: 'var(--segmented-bg)', color: 'var(--text-muted)' }}
            >
              Pênaltis {jogo.penaltis_casa}×{jogo.penaltis_fora}
            </span>
          )}
        </div>
      )}

      {jogo.tipo_fase === 'mata_mata' && (classificadoOficial || classificadoPalpite) && (
        <div
          className="rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
          style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>Classificado</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span style={{ color: 'var(--text-muted)' }}>Oficial</span>
            {classificadoOficial ? (
              <>
                <CountryFlag pais={classificadoOficial} size="sm" />
                <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {classificadoOficial.nome}
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>–</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span style={{ color: 'var(--text-muted)' }}>Palpite</span>
            {classificadoPalpite ? (
              <>
                <CountryFlag pais={classificadoPalpite} size="sm" />
                <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {classificadoPalpite.nome}
                </span>
                {classificadoCorreto ? <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} /> : null}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Não informado</span>
            )}
          </div>
        </div>
      )}

      {marcadoresBrasilHabilitado && marcadoresValidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {marcadoresValidos.map((marcador) => (
            <span
              key={`${marcador.nome_jogador}-${marcador.quantidade_gols}`}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {marcador.nome_jogador} · {marcador.quantidade_gols} gol{marcador.quantidade_gols === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      )}

      {palpite && (
        <div
          className="rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
          style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}
        >
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {breakdownComPontos.length > 0 ? (
              breakdownComPontos.map(({ label, pts }) => (
                <span
                  key={label}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  {label} +{pts}
                </span>
              ))
            ) : (
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Sem pontos neste jogo
              </span>
            )}
          </div>
          <p className="text-lg font-black tabular-nums shrink-0" style={{ color: palpite.pontuacao_total > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {palpite.pontuacao_total}
            <span className="text-xs font-semibold ml-1">pts</span>
          </p>
        </div>
      )}
    </div>
  )
}
