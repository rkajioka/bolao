import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthContext'
import { GameCard } from '@/components/GameCard'
import { OfficialResultsPanel } from '@/features/official-results/OfficialResultsPanel'
import { GameCardSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { SectionHeader } from '@/components/SectionHeader'
import { GroupStandingsTable } from '@/components/GroupStandingsTable'
import { SegmentedControl } from '@/components/SegmentedControl'
import { useToast } from '@/components/Toast'
import type {
  ConfiguracaoBolao,
  Jogo,
  PalpiteJogo,
  MarcadorCandidato,
  GruposListResponse,
  TabelaGrupoResponse,
} from '@/types'
import { CalendarDays } from 'lucide-react'
import {
  compareJogosPorDataJogoAsc,
  jogoBloqueado,
  palpiteDefaultSegmentKey,
  palpiteSegmentKey,
  palpiteSegmentOptionsFromJogos,
} from '@/lib/utils'

type Tab = 'cronologico' | 'grupos'
type StatusFiltro = 'abertos' | 'fechados'

const TAB_SEGMENTS = [
  { key: 'cronologico' as Tab, label: 'Cronológico' },
  { key: 'grupos' as Tab, label: 'Por grupo' },
]

const STATUS_SEGMENTS = [
  { key: 'abertos' as StatusFiltro, label: 'Em aberto' },
  { key: 'fechados' as StatusFiltro, label: 'Fechados' },
]

export function JogosPage() {
  const [tab, setTab] = useState<Tab>('cronologico')
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>('abertos')
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>('A')
  const [segmentoCrono, setSegmentoCrono] = useState<string>('')
  const [segmentoGrupo, setSegmentoGrupo] = useState<string>('')
  const { success, error } = useToast()
  const queryClient = useQueryClient()
  const { canParticipate, canLancarResultadoOficial } = useAuth()

  const { data: jogosCrono = [], isLoading: loadingJogos } = useQuery({
    queryKey: ['jogos', 'cronologico'],
    queryFn: () => api.get<Jogo[]>('/jogos/cronologico'),
  })

  const { data: palpites = [] } = useQuery({
    queryKey: ['palpites', 'me'],
    queryFn: () => api.get<PalpiteJogo[]>('/palpites-jogos/me'),
    enabled: canParticipate,
  })

  const { data: configBolao } = useQuery({
    queryKey: ['configuracao-bolao', 'minha'],
    queryFn: () => api.get<ConfiguracaoBolao>('/configuracao-bolao/minha'),
    enabled: canParticipate,
  })

  const marcadoresBrasilHabilitado = Boolean(configBolao?.marcadores_brasil_habilitado)

  const { data: candidatos = [] } = useQuery({
    queryKey: ['marcadores', 'candidatos'],
    queryFn: () => api.get<MarcadorCandidato[]>('/marcadores-brasil/candidatos'),
    enabled: canParticipate && marcadoresBrasilHabilitado,
  })

  const { data: gruposDisponiveis = [] } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      const resp = await api.get<GruposListResponse>('/grupos')
      return resp.grupos ?? []
    },
  })

  const { data: tabelaGrupo = [], isLoading: loadingTabelaGrupo } = useQuery({
    queryKey: ['grupos', 'tabela', grupoSelecionado],
    queryFn: async () => {
      const resp = await api.get<TabelaGrupoResponse>(`/grupos/${grupoSelecionado}/tabela`)
      return resp.linhas ?? []
    },
    enabled: tab === 'grupos' && !!grupoSelecionado,
  })

  const palpiteMap = new Map(palpites.map((p) => [p.jogo_id, p]))

  useEffect(() => {
    if (!gruposDisponiveis.length) return
    if (!gruposDisponiveis.includes(grupoSelecionado)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrupoSelecionado(gruposDisponiveis[0])
    }
  }, [gruposDisponiveis, grupoSelecionado])

  const handleSave = async (
    jogoId: number,
    casa: number,
    fora: number,
    classificado?: number | null,
  ) => {
    const jogo = jogosCrono.find((item) => item.id === jogoId)
    if (jogo && jogoBloqueado(jogo, jogosCrono)) {
      error('O prazo para este palpite já encerrou.')
      return
    }
    const existing = palpiteMap.get(jogoId)
    try {
      if (existing) {
        await api.put(`/palpites-jogos/${existing.id}`, {
          palpite_casa: casa,
          palpite_fora: fora,
          palpite_classificado_id: classificado ?? null,
        })
      } else {
        await api.post('/palpites-jogos', {
          jogo_id: jogoId,
          palpite_casa: casa,
          palpite_fora: fora,
          palpite_classificado_id: classificado ?? null,
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['palpites'] })
      await queryClient.invalidateQueries({ queryKey: ['marcadores-brasil', 'me', jogoId] })
      success('Palpite salvo!')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar palpite')
      throw err
    }
  }

  const handleResultadoOficialSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: ['jogos'] })
    success('Resultado oficial salvo e jogo finalizado.')
  }

  const handleJogoAtualizado = async () => {
    await queryClient.invalidateQueries({ queryKey: ['jogos'] })
    success('Jogo atualizado.')
  }

  const handleSaveMarcadores = async (
    jogoId: number,
    marcadores: { nome_jogador: string; quantidade_gols: number }[],
  ) => {
    const jogo = jogosCrono.find((item) => item.id === jogoId)
    if (jogo && jogoBloqueado(jogo, jogosCrono)) {
      error('O prazo para os marcadores deste jogo já encerrou.')
      return
    }
    const existing = palpiteMap.get(jogoId)
    if (!existing) return
    try {
      await api.put(`/marcadores-brasil/${jogoId}`, { marcadores })
      await queryClient.invalidateQueries({ queryKey: ['marcadores-brasil', 'me', jogoId] })
      success('Marcadores salvos!')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar marcadores')
      throw err
    }
  }

  /** Uma única ordenação crescente por data; sublistas só filtram e preservam essa ordem. */
  const jogosOrdenadosAsc = useMemo(
    () => [...jogosCrono].sort(compareJogosPorDataJogoAsc),
    [jogosCrono],
  )

  const isJogoAberto = (jogo: Jogo) => !jogoBloqueado(jogo, jogosCrono)
  const isJogoFinalizado = (jogo: Jogo) => jogo.finalizado
  const isJogoFechado = (jogo: Jogo) => !isJogoAberto(jogo) && !isJogoFinalizado(jogo)

  /** Filtros recalculados a cada render (jogoBloqueado usa Date.now); ordem vem sempre de jogosOrdenadosAsc. */
  const jogosCronoAbertos = jogosOrdenadosAsc.filter((jogo) => isJogoAberto(jogo))

  const jogosCronoFechados = [
    ...jogosOrdenadosAsc.filter((jogo) => isJogoFechado(jogo) || isJogoFinalizado(jogo)),
  ].reverse()

  const jogosCronoPendentesOficial = jogosOrdenadosAsc.filter((jogo) => !jogo.finalizado)
  const jogosCronoFinalizadosOficial = [...jogosOrdenadosAsc.filter((jogo) => jogo.finalizado)].reverse()

  const jogosCronoFiltrados = filtroStatus === 'abertos' ? jogosCronoAbertos : jogosCronoFechados

  const jogosDoGrupoSelecionado = jogosOrdenadosAsc.filter(
    (jogo) => jogo.tipo_fase === 'grupos' && (jogo.grupo || '').toUpperCase() === grupoSelecionado,
  )

  const jogosGrupoAbertos = jogosDoGrupoSelecionado.filter((jogo) => isJogoAberto(jogo))

  const jogosGrupoFechados = [
    ...jogosDoGrupoSelecionado.filter((jogo) => isJogoFechado(jogo) || isJogoFinalizado(jogo)),
  ].reverse()

  const jogosDoGrupoFiltrados = filtroStatus === 'abertos' ? jogosGrupoAbertos : jogosGrupoFechados

  const segmentosCrono = useMemo(
    () => palpiteSegmentOptionsFromJogos(jogosCronoFiltrados),
    [jogosCronoFiltrados],
  )

  const segmentosGrupo = useMemo(
    () => palpiteSegmentOptionsFromJogos(jogosDoGrupoFiltrados),
    [jogosDoGrupoFiltrados],
  )

  const segmentoCronoAtivo = useMemo(() => {
    if (!segmentosCrono.length) return ''
    if (segmentosCrono.some((s) => s.key === segmentoCrono)) return segmentoCrono
    return palpiteDefaultSegmentKey(jogosCronoFiltrados) ?? segmentosCrono[0].key
  }, [segmentosCrono, segmentoCrono, jogosCronoFiltrados])

  const segmentoGrupoAtivo = useMemo(() => {
    if (!segmentosGrupo.length) return ''
    if (segmentosGrupo.some((s) => s.key === segmentoGrupo)) return segmentoGrupo
    return palpiteDefaultSegmentKey(jogosDoGrupoFiltrados) ?? segmentosGrupo[0].key
  }, [segmentosGrupo, segmentoGrupo, jogosDoGrupoFiltrados])

  useEffect(() => {
    if (segmentoCronoAtivo !== segmentoCrono) {
      setSegmentoCrono(segmentoCronoAtivo)
    }
  }, [segmentoCronoAtivo, segmentoCrono])

  useEffect(() => {
    if (segmentoGrupoAtivo !== segmentoGrupo) {
      setSegmentoGrupo(segmentoGrupoAtivo)
    }
  }, [segmentoGrupoAtivo, segmentoGrupo])

  const jogosCronoNaFase = useMemo(
    () => jogosCronoFiltrados.filter((j) => palpiteSegmentKey(j) === segmentoCronoAtivo),
    [jogosCronoFiltrados, segmentoCronoAtivo],
  )

  const jogosGrupoNaFase = useMemo(
    () => jogosDoGrupoFiltrados.filter((j) => palpiteSegmentKey(j) === segmentoGrupoAtivo),
    [jogosDoGrupoFiltrados, segmentoGrupoAtivo],
  )

  if (canLancarResultadoOficial) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title="Jogos"
          subtitle="Lance os resultados oficiais das partidas"
        />

        <SegmentedControl
          segments={[
            { key: 'abertos' as StatusFiltro, label: 'Pendentes' },
            { key: 'fechados' as StatusFiltro, label: 'Finalizados' },
          ]}
          value={filtroStatus}
          onChange={setFiltroStatus}
          controlId="owner-resultados"
        />

        {loadingJogos ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : jogosCrono.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={28} style={{ color: 'var(--text-muted)' }} />}
            title="Nenhum jogo cadastrado"
            description="Os jogos aparecerão aqui quando forem adicionados."
          />
        ) : (
          <OfficialResultsPanel
            jogos={filtroStatus === 'abertos' ? jogosCronoPendentesOficial : jogosCronoFinalizadosOficial}
            readOnly={filtroStatus === 'fechados'}
            showFlags
            showDateFilter={filtroStatus === 'abertos'}
            showFaseFilter={filtroStatus === 'abertos'}
            showGrupoFilter={filtroStatus === 'abertos'}
            groupByGrupo={filtroStatus === 'abertos'}
            allowEditMetadata={filtroStatus === 'abertos'}
            emptyMessage={
              filtroStatus === 'abertos'
                ? 'Nenhum jogo pendente de finalização.'
                : 'Nenhum jogo finalizado ainda.'
            }
            onSaved={handleResultadoOficialSaved}
            onMetadataSaved={handleJogoAtualizado}
            onError={(msg) => error(msg)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Palpites" subtitle="Faça seus palpites antes do fechamento" />

      <SegmentedControl
        segments={TAB_SEGMENTS}
        value={tab}
        onChange={setTab}
        controlId="jogos-tab"
      />

      {loadingJogos ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <GameCardSkeleton key={i} />)}
        </div>
      ) : jogosCrono.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} style={{ color: 'var(--text-muted)' }} />}
          title="Nenhum jogo cadastrado"
          description="Os jogos aparecerão aqui quando forem adicionados."
        />
      ) : (
        <div className="space-y-3">
          {tab === 'cronologico' ? (
            <div className="space-y-3">
              <SegmentedControl
                segments={STATUS_SEGMENTS}
                value={filtroStatus}
                onChange={setFiltroStatus}
                controlId="crono-status"
              />

              {segmentosCrono.length > 1 && (
                <SegmentedControl
                  segments={segmentosCrono}
                  value={segmentoCronoAtivo}
                  onChange={setSegmentoCrono}
                  controlId="crono-fase"
                  scrollable={segmentosCrono.length > 3}
                />
              )}

              {jogosCronoFiltrados.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays size={26} style={{ color: 'var(--text-muted)' }} />}
                  title={filtroStatus === 'abertos' ? 'Nenhum jogo em aberto' : 'Nenhum jogo fechado'}
                  description={
                    filtroStatus === 'abertos'
                      ? 'Você não tem jogos abertos para preencher no momento.'
                      : 'Os jogos fechados/finalizados aparecerão aqui.'
                  }
                />
              ) : (
                jogosCronoNaFase.map((jogo) => (
                  <GameCard
                    key={jogo.id}
                    jogo={jogo}
                    palpite={palpiteMap.get(jogo.id) ?? null}
                    todosJogos={jogosCrono}
                    onSave={handleSave}
                    onSaveMarcadores={marcadoresBrasilHabilitado ? handleSaveMarcadores : undefined}
                    candidatos={candidatos}
                    marcadoresBrasilHabilitado={marcadoresBrasilHabilitado}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-7 pt-2">
              <div className="space-y-2">
                <p className="text-xs font-medium px-1" style={{ color: 'var(--text-muted)' }}>
                  Selecionar grupo
                </p>
                <div className="flex gap-2 flex-wrap">
                  {gruposDisponiveis.map((grupo) => (
                    <button
                      key={grupo}
                      onClick={() => setGrupoSelecionado(grupo)}
                      className="px-3 py-1.5 rounded-xl text-sm font-bold transition-all duration-150"
                      style={{
                        background: grupoSelecionado === grupo ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${grupoSelecionado === grupo ? 'var(--accent)' : 'rgba(255,255,255,0.10)'}`,
                        color: grupoSelecionado === grupo ? '#070A12' : 'var(--text-muted)',
                      }}
                    >
                      {grupo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--accent)' }}>
                  Classificação do Grupo {grupoSelecionado}
                </h3>
                <p className="text-xs mb-3 px-1" style={{ color: 'var(--text-muted)' }}>
                  Classificação calculada com base nos resultados oficiais cadastrados.
                </p>
                <GroupStandingsTable
                  grupoSelecionado={grupoSelecionado}
                  tabela={tabelaGrupo}
                  isLoading={loadingTabelaGrupo}
                />
              </div>

              <div className="space-y-3">
                <SegmentedControl
                  segments={STATUS_SEGMENTS}
                  value={filtroStatus}
                  onChange={setFiltroStatus}
                  controlId="grupos-status"
                />

                {segmentosGrupo.length > 1 && (
                  <SegmentedControl
                    segments={segmentosGrupo}
                    value={segmentoGrupoAtivo}
                    onChange={setSegmentoGrupo}
                    controlId="grupo-fase"
                    scrollable={segmentosGrupo.length > 3}
                  />
                )}

                <h3 className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: 'var(--accent)' }}>
                  Palpites do Grupo {grupoSelecionado}
                </h3>

                {jogosDoGrupoFiltrados.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Nenhum jogo {filtroStatus === 'abertos' ? 'em aberto' : 'fechado'} para o grupo {grupoSelecionado}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jogosGrupoNaFase.map((jogo) => (
                      <GameCard
                        key={jogo.id}
                        jogo={jogo}
                        palpite={palpiteMap.get(jogo.id) ?? null}
                        todosJogos={jogosCrono}
                        onSave={handleSave}
                        onSaveMarcadores={marcadoresBrasilHabilitado ? handleSaveMarcadores : undefined}
                        candidatos={candidatos}
                        marcadoresBrasilHabilitado={marcadoresBrasilHabilitado}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
