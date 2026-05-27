import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, Star, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RankingCardSkeleton, PodiumSkeleton } from '@/components/Skeleton'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'
import { imgUrl } from '@/lib/utils'
import { UserAvatar } from '@/components/UserAvatar'
import { CountryFlag } from '@/components/CountryFlag'
import { rankingService } from '@/services/ranking.service'
import type { ConfiguracaoBolao, Pais, RankingLinha } from '@/types'
import { regrasService } from '@/services/regras.service'
import { api } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthContext'
import { OwnerEmpresaPicker } from '@/components/OwnerEmpresaPicker'
import { useResolvedEmpresaForAdmin } from '@/hooks/useResolvedEmpresaForAdmin'
import { empresaService } from '@/services/empresa.service'

type Aba = 'classificacao' | 'insights'
type SortBy = 'total' | 'jogos' | 'especiais'

const ABA_SEGMENTS = [
  { key: 'classificacao' as Aba, label: 'Classificação' },
  { key: 'insights' as Aba, label: 'Insights' },
]

const SORT_SEGMENTS = [
  { key: 'total' as SortBy, label: 'Total' },
  { key: 'jogos' as SortBy, label: 'Jogos' },
  { key: 'especiais' as SortBy, label: 'Especiais' },
]

const MEDAL_CONFIG = [
  { color: '#F6C65B', shadow: 'rgba(246,198,91,0.20)', rgb: '246,198,91', label: '1º', symbol: '🥇' },
  { color: '#A7B0C0', shadow: 'rgba(167,176,192,0.15)', rgb: '167,176,192', label: '2º', symbol: '🥈' },
  { color: '#CD7F32', shadow: 'rgba(205,127,50,0.15)', rgb: '205,127,50', label: '3º', symbol: '🥉' },
]

const PODIUM_LAYOUT = [
  {
    medalSize: 'text-3xl',
    avatarSize: 'w-14 h-14',
    avatarIcon: 22,
    pointsClass: 'text-3xl',
    nameMax: 'max-w-[96px]',
    minHeight: 184,
    pedestal: 14,
    flex: 1.2,
    bgAlpha: 0.16,
    borderAlpha: 0.42,
    glow: '0 14px 36px rgba(246,198,91,0.22), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
  {
    medalSize: 'text-2xl',
    avatarSize: 'w-12 h-12',
    avatarIcon: 20,
    pointsClass: 'text-xl',
    nameMax: 'max-w-[88px]',
    minHeight: 156,
    pedestal: 10,
    flex: 1.05,
    bgAlpha: 0.1,
    borderAlpha: 0.28,
    glow: 'none',
  },
  {
    medalSize: 'text-2xl',
    avatarSize: 'w-12 h-12',
    avatarIcon: 20,
    pointsClass: 'text-xl',
    nameMax: 'max-w-[88px]',
    minHeight: 140,
    pedestal: 8,
    flex: 1.05,
    bgAlpha: 0.1,
    borderAlpha: 0.28,
    glow: 'none',
  },
] as const

function sortValue(linha: RankingLinha, sort: SortBy): number {
  if (sort === 'jogos') return linha.pontos_jogos
  if (sort === 'especiais') return linha.pontos_especiais + linha.bonus_brasil
  return linha.pontos_totais
}

/** Bandeiras do pódio nos especiais (1º, 2º e 3º) — sem artilheiro. */
function RankingEspeciaisFlags({
  linha,
  getPais,
}: {
  linha: Pick<RankingLinha, 'campeao_id' | 'vice_campeao_id' | 'terceiro_lugar_id'>
  getPais: (id?: number | null) => Pais | null
}) {
  const slots: { ord: string; id: number | null | undefined }[] = [
    { ord: '1º', id: linha.campeao_id },
    { ord: '2º', id: linha.vice_campeao_id },
    { ord: '3º', id: linha.terceiro_lugar_id },
  ]
  const items = slots
    .map(({ ord, id }) => {
      const p = getPais(id)
      return p ? { ord, p } : null
    })
    .filter((x): x is { ord: string; p: Pais } => x !== null)
  if (items.length === 0) return null
  return (
    <motion.div className="flex items-center gap-0.5 shrink-0" aria-label="Palpites especiais: pódio">
      {items.map(({ ord, p }) => (
        <span key={`${ord}-${p.id}`} title={`${ord} lugar: ${p.nome}`} className="leading-none">
          <CountryFlag pais={p} size="xs" />
        </span>
      ))}
    </motion.div>
  )
}

function RankingRowAvatar({ src, alt }: { src?: string | null; alt: string }) {
  return <UserAvatar src={src} alt={alt} size="md" />
}

export function RankingPage() {
  const { user, empresaId: authEmpresaId } = useAuth()
  const { resolvedEmpresaId, setOwnerEmpresaId, needsOwnerEmpresaPick } = useResolvedEmpresaForAdmin()
  const [aba, setAba] = useState<Aba>('classificacao')
  const [sortBy, setSortBy] = useState<SortBy>('total')

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
    enabled: needsOwnerEmpresaPick,
  })

  useEffect(() => {
    if (!needsOwnerEmpresaPick || resolvedEmpresaId != null || empresas.length === 0) return
    setOwnerEmpresaId(empresas[0].id)
  }, [needsOwnerEmpresaPick, resolvedEmpresaId, empresas, setOwnerEmpresaId])

  const effectiveEmpresaId = needsOwnerEmpresaPick ? resolvedEmpresaId : authEmpresaId
  const rankingEnabled = !needsOwnerEmpresaPick || effectiveEmpresaId != null

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ranking', effectiveEmpresaId],
    queryFn: () => rankingService.get(needsOwnerEmpresaPick ? effectiveEmpresaId : undefined),
    enabled: rankingEnabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => api.get<Pais[]>('/paises'),
    staleTime: Infinity,
  })
  const { data: insights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['ranking', 'insights', effectiveEmpresaId],
    queryFn: () => rankingService.getInsights(needsOwnerEmpresaPick ? effectiveEmpresaId : undefined),
    enabled: rankingEnabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
  const { data: configBolao } = useQuery({
    queryKey: ['configuracao-bolao', 'minha'],
    queryFn: () => regrasService.getConfigMinha(),
    enabled: !needsOwnerEmpresaPick,
  })
  const marcadoresBrasilHabilitado = needsOwnerEmpresaPick
    ? empresas.find((e) => e.id === effectiveEmpresaId)?.marcadores_brasil_habilitado ?? false
    : Boolean(configBolao?.marcadores_brasil_habilitado)

  const linhas = data?.linhas ?? []

  const sortedLinhas = sortBy === 'total'
    ? linhas
    : [...linhas].sort((a, b) => sortValue(b, sortBy) - sortValue(a, sortBy))

  const top3 = sortedLinhas.slice(0, 3)
  const top50 = sortedLinhas.slice(0, 50)
  const listaTop50 = top50.slice(3)

  const linhaUsuario = linhas.find((l) => l.usuario_id === user?.id)
  const linhaUsuarioSorted = sortedLinhas.find((l) => l.usuario_id === user?.id)
  const posicaoUsuario = sortedLinhas.findIndex((l) => l.usuario_id === user?.id) + 1
  const usuarioForaTop50 = posicaoUsuario > 50

  const getPais = (id?: number | null) => paises.find((p) => p.id === id) ?? null
  const liderPts = top3[0] ? sortValue(top3[0], sortBy) : 0

  const sortLabel = sortBy === 'jogos' ? 'pts jogos' : sortBy === 'especiais' ? 'pts especiais' : 'pts'

  const formatMetricaEmpresa = (metrica: { valor: number; total?: number | null }) => {
    if (metrica.total != null && metrica.total > 0 && metrica.total !== 100) {
      return `${metrica.valor} de ${metrica.total}`
    }
    if (metrica.total === 100) {
      return `${metrica.valor}%`
    }
    return String(metrica.valor)
  }

  const destaqueSecoes = insights
    ? [
        { titulo: 'Mais pontos na rodada/fase', itens: insights.destaques_usuarios.pontos_bloco, cor: 'var(--accent)' },
        { titulo: 'Mais placares exatos', itens: insights.destaques_usuarios.placar_exato, cor: 'var(--highlight)' },
        { titulo: 'Mais resultados corretos', itens: insights.destaques_usuarios.resultado, cor: 'var(--accent)' },
        { titulo: 'Mais classificados corretos', itens: insights.destaques_usuarios.classificado, cor: 'var(--highlight)' },
      ].filter((secao) => secao.itens.length > 0)
    : []

  return (
    <div className="space-y-4">
      <SectionHeader title="Ranking" subtitle="Classificação geral do bolão" />

      {needsOwnerEmpresaPick && (
        <OwnerEmpresaPicker value={resolvedEmpresaId} onChange={setOwnerEmpresaId} />
      )}

      {needsOwnerEmpresaPick && effectiveEmpresaId == null && (
        <p className="text-sm px-1" style={{ color: 'var(--text-muted)' }}>
          Selecione uma empresa para ver o ranking.
        </p>
      )}

      <SegmentedControl
        segments={ABA_SEGMENTS}
        value={aba}
        onChange={setAba}
        controlId="ranking-aba"
      />

      {/* Minha posição */}
      {aba === 'classificacao' && linhaUsuario && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(53,208,127,0.06)', border: '1px solid rgba(53,208,127,0.28)' }}
          aria-label="Sua posição no ranking"
        >
          <div className="flex items-center justify-center w-9 shrink-0">
            <span className="text-lg font-black tabular-nums" style={{ color: 'var(--accent)' }}>
              #{posicaoUsuario}
            </span>
          </div>
          <RankingRowAvatar src={linhaUsuario.imagem_perfil} alt={linhaUsuario.nome} />
          <motion.div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{linhaUsuario.nome}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {posicaoUsuario === 1
                ? top50[1]
                  ? `+${sortValue(linhaUsuario, sortBy) - sortValue(top50[1], sortBy)} do 2º`
                  : 'Líder'
                : `${liderPts - sortValue(linhaUsuario, sortBy)} pts atrás do líder`}
            </p>
          </motion.div>
          <RankingEspeciaisFlags linha={linhaUsuario} getPais={getPais} />
          <div className="text-right shrink-0">
            <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--accent)' }}>
              {sortValue(linhaUsuario, sortBy)}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sortLabel}</p>
          </div>
        </motion.div>
      )}

      {aba === 'classificacao' && (isLoading ? (
        <div aria-busy="true" aria-label="Carregando ranking">
          <PodiumSkeleton />
          <div className="space-y-2 mt-2">
            {[1, 2, 3, 4].map((i) => <RankingCardSkeleton key={i} />)}
          </div>
        </div>
      ) : isError ? (
        <EmptyState
          icon={<Trophy size={28} style={{ color: 'var(--text-muted)' }} />}
          title="Não foi possível carregar o ranking"
          description="Verifique sua conexão e tente novamente."
          action={
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Tentar novamente
            </button>
          }
        />
      ) : linhas.length === 0 ? (
        <EmptyState
          icon={<Trophy size={28} style={{ color: 'var(--text-muted)' }} />}
          title="Ranking vazio"
          description="Os pontos aparecerão após os jogos serem finalizados."
        />
      ) : (
        <>
          {/* Filtro de ordenação */}
          <div className="space-y-1">
            <p className="text-[11px] font-medium px-0.5" style={{ color: 'var(--text-muted)' }}>
              Ordenar por
            </p>
            <SegmentedControl
              segments={SORT_SEGMENTS}
              value={sortBy}
              onChange={setSortBy}
              controlId="ranking-sort"
            />
          </div>

          <div className="space-y-2">
            {/* Pódio top 3 */}
            {top3.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24 }}
                className="glass rounded-3xl p-3 mb-5"
                style={{ border: '1px solid var(--border)' }}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider px-1 pb-2" style={{ color: 'var(--text-muted)' }}>
                  Pódio
                </p>
                <div className="flex gap-3 items-end" role="list" aria-label="Top 3 do ranking">
                  {([1, 0, 2] as const).filter((idx) => top3[idx]).map((idx) => {
                    const linha = top3[idx]
                    const p = MEDAL_CONFIG[idx]
                    const layout = PODIUM_LAYOUT[idx]
                    const isMe = linha.usuario_id === user?.id
                    const pts = sortValue(linha, sortBy)
                    const liderVal = sortValue(top3[0], sortBy)
                    const diff = idx === 0
                      ? top3[1] ? pts - sortValue(top3[1], sortBy) : null
                      : liderVal - pts
                    const borderAlpha = isMe ? 0.62 : layout.borderAlpha
                    const meRing = isMe ? '0 0 0 2px var(--accent), 0 0 16px rgba(53,208,127,0.16)' : 'none'
                    const boxShadow = layout.glow === 'none' ? meRing : `${layout.glow}${isMe ? `, ${meRing}` : ''}`

                    return (
                      <motion.div
                        key={linha.usuario_id}
                        role="listitem"
                        aria-label={`${p.label} lugar: ${linha.nome}, ${pts} pontos`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, delay: idx * 0.06 }}
                        className="flex min-w-0 flex-col"
                        style={{ flex: layout.flex }}
                      >
                        <div
                          className="flex flex-col items-center justify-end gap-1.5 rounded-t-2xl px-2.5 py-3 text-center"
                          style={{
                            minHeight: layout.minHeight,
                            background: `linear-gradient(180deg, rgba(${p.rgb},${layout.bgAlpha + 0.04}) 0%, rgba(${p.rgb},${layout.bgAlpha}) 100%)`,
                            border: `1px solid rgba(${p.rgb},${borderAlpha})`,
                            borderBottom: 'none',
                            boxShadow,
                          }}
                        >
                          <span className={`${layout.medalSize} leading-none`} aria-hidden="true">{p.symbol}</span>
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: p.color }}>
                            {p.label} lugar
                          </p>
                          <div
                            className={`${layout.avatarSize} rounded-full flex items-center justify-center text-xs font-bold overflow-hidden`}
                            style={{ background: 'var(--glass)', border: `2px solid ${p.color}` }}
                          >
                            {linha.imagem_perfil ? (
                              <img src={imgUrl(linha.imagem_perfil)} alt={linha.nome} className="w-full h-full object-cover" />
                            ) : (
                              <User size={layout.avatarIcon} style={{ color: p.color }} aria-hidden />
                            )}
                          </div>
                          <div>
                            <p className={`text-xs font-semibold truncate ${layout.nameMax}`}>{linha.nome.split(' ')[0]}</p>
                            <p className={`${layout.pointsClass} font-black tabular-nums leading-tight mt-0.5`} style={{ color: p.color }}>
                              {pts}
                            </p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sortLabel}</p>
                          </div>
                          {diff !== null && diff > 0 && (
                            <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                              {idx === 0 ? `+${diff} do 2º` : `-${diff}`}
                            </p>
                          )}
                          <RankingEspeciaisFlags linha={linha} getPais={getPais} />
                        </div>
                        <div
                          aria-hidden="true"
                          className="w-full rounded-b-xl"
                          style={{
                            height: layout.pedestal,
                            background: `linear-gradient(180deg, rgba(${p.rgb},0.55) 0%, ${p.color} 100%)`,
                            boxShadow: idx === 0 ? `0 8px 18px ${p.shadow}` : 'none',
                          }}
                        />
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Posições 4..50 */}
            {listaTop50.map((linha, i) => {
              const isMe = linha.usuario_id === user?.id
              const pts = sortValue(linha, sortBy)
              const prevPts = i === 0 ? sortValue(top3[2], sortBy) : sortValue(listaTop50[i - 1], sortBy)
              const diffDoPrev = prevPts - pts
              const diffDoLider = liderPts - pts
              const posicaoAtual = i + 4

              return (
                <motion.div
                  key={linha.usuario_id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: Math.min((i + 3) * 0.025, 0.4) }}
                  className="flex items-center gap-3 px-3 py-2 rounded-2xl"
                  aria-label={`${posicaoAtual}º lugar: ${linha.nome}, ${pts} pontos`}
                  style={{
                    background: isMe ? 'rgba(53,208,127,0.06)' : 'var(--glass)',
                    border: `1px solid ${isMe ? 'rgba(53,208,127,0.25)' : 'var(--border)'}`,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <span
                    className="w-6 text-center font-bold tabular-nums shrink-0"
                    style={{ color: isMe ? 'var(--accent)' : 'var(--text-muted)', fontSize: '13px' }}
                  >
                    {posicaoAtual}
                  </span>
                  <RankingRowAvatar src={linha.imagem_perfil} alt={linha.nome} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate leading-tight">
                      {linha.nome}
                      {isMe && <span style={{ color: 'var(--accent)' }}> · Você</span>}
                    </p>
                    <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {diffDoPrev > 0 ? `-${diffDoPrev} · ` : ''}{diffDoLider > 0 ? `${diffDoLider} do líder` : 'Líder'}
                    </p>
                  </div>
                  <RankingEspeciaisFlags linha={linha} getPais={getPais} />
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm tabular-nums">{pts}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {sortBy === 'total'
                        ? `J:${linha.pontos_jogos} E:${linha.pontos_especiais}${marcadoresBrasilHabilitado && linha.bonus_brasil > 0 ? ` BR:${linha.bonus_brasil}` : ''}`
                        : sortLabel}
                    </p>
                  </div>
                </motion.div>
              )
            })}

            {/* Usuário fora do top 50 */}
            {usuarioForaTop50 && linhaUsuarioSorted && (
              <>
                <div className="text-center py-1">
                  <span className="text-xs tracking-widest" style={{ color: 'var(--text-muted)' }}>· · ·</span>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-2xl"
                  style={{
                    background: 'rgba(53,208,127,0.06)',
                    border: '1px solid rgba(53,208,127,0.25)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <span className="w-6 text-center font-bold text-sm tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
                    {posicaoUsuario}
                  </span>
                  <RankingRowAvatar src={linhaUsuarioSorted.imagem_perfil} alt={linhaUsuarioSorted.nome} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {linhaUsuarioSorted.nome} <span style={{ color: 'var(--accent)' }}> · Você</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {liderPts - sortValue(linhaUsuarioSorted, sortBy) > 0
                        ? `${liderPts - sortValue(linhaUsuarioSorted, sortBy)} pts atrás do líder`
                        : 'Fora do top 50'}
                    </p>
                  </div>
                  <RankingEspeciaisFlags linha={linhaUsuarioSorted} getPais={getPais} />
                  <motion.div className="text-right shrink-0">
                    <p className="font-black text-sm tabular-nums">{sortValue(linhaUsuarioSorted, sortBy)}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sortLabel}</p>
                  </motion.div>
                </motion.div>
              </>
            )}
          </div>
        </>
      ))}

      {/* Aba Insights */}
      {aba === 'insights' && (
        <div className="space-y-3" role="tabpanel" aria-label="Insights do período">
          {isLoadingInsights ? (
            <div className="glass rounded-2xl p-8 text-center">
              <div
                className="w-7 h-7 rounded-full border-2 animate-spin mx-auto"
                style={{ borderColor: 'rgba(53,208,127,0.2)', borderTopColor: 'var(--accent)' }}
              />
            </div>
          ) : !insights ? (
            <div className="glass rounded-2xl p-4">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Insights indisponíveis no momento.
              </p>
            </div>
          ) : insights.periodo_status === 'aguardando_primeiro_bloco' ? (
            <EmptyState
              icon={<TrendingUp size={28} style={{ color: 'var(--text-muted)' }} />}
              title="Aguardando a primeira rodada/fase"
              description="Os insights aparecerão quando a primeira rodada ou fase do torneio for totalmente encerrada."
            />
          ) : (
            <>
              {insights.periodo_status === 'bloco_em_andamento' && insights.periodo_em_andamento_label && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl px-4 py-3 text-sm"
                  style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.25)' }}
                >
                  A rodada/fase {insights.periodo_em_andamento_label} ainda está em andamento. Os números abaixo refletem a última rodada ou fase totalmente encerrada.
                </motion.div>
              )}

              <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                    {insights.periodo_label}
                  </p>
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                    {insights.jogos_periodo} jogo{insights.jogos_periodo !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {insights.metricas_empresa.length > 0 && (
                <div className="glass rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Bolão
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {insights.metricas_empresa.map((metrica) => (
                      <div
                        key={metrica.chave}
                        className="rounded-xl p-3"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <p className="text-lg font-black tabular-nums">{formatMetricaEmpresa(metrica)}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{metrica.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {destaqueSecoes.length > 0 && (
                <div className="glass rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Destaques
                  </p>
                  {destaqueSecoes.map((secao) => (
                    <div key={secao.titulo} className="space-y-2">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{secao.titulo}</p>
                      {secao.itens.map((item) => (
                        <div key={`${secao.titulo}-${item.usuario_id}`} className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate">{item.nome}</span>
                          <span className="text-xs font-semibold tabular-nums" style={{ color: secao.cor }}>
                            {item.valor}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Star size={14} style={{ color: 'var(--highlight)' }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--highlight)' }}>
                    Meu período
                  </p>
                  {insights.minha_posicao_periodo != null && (
                    <span className="text-xs ml-auto font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
                      #{insights.minha_posicao_periodo} na rodada/fase
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: insights.meus_pontos_periodo, label: 'pts na rodada/fase', color: 'var(--accent)' },
                    { value: insights.meu_preenchidos, label: 'palpites', color: 'var(--text)' },
                    { value: insights.meu_acertos_placar_exato, label: 'placar exato', color: 'var(--highlight)' },
                    { value: insights.meu_acertos_resultado, label: 'resultados', color: 'var(--text)' },
                    { value: insights.meus_acertos_classificado, label: 'classificados', color: 'var(--highlight)' },
                  ].map(({ value, label, color }) => (
                    <div
                      key={label}
                      className="rounded-xl p-3 text-center"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <p className="text-lg font-black tabular-nums" style={{ color }}>{value}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
