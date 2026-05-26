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
import { JogosFilters, type JogosStatusFiltro, type JogosTab } from '@/components/JogosFilters'
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

type OwnerStatusFiltro = 'abertos' | 'fechados'

export function JogosPage() {
  const [tab, setTab] = useState<JogosTab>('cronologico')
  const [filtroStatus, setFiltroStatus] = useState<JogosStatusFiltro>('abertos')
  const [ownerFiltroStatus, setOwnerFiltroStatus] = useState<OwnerStatusFiltro>('abertos')
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>('A')
  const [segmentoCrono, setSegmentoCrono] = useState<string>('')
  const [segmentoGrupo, setSegmentoGrupo] = useState<string>('')
  const { success, error } = useToast()
  const queryClient = useQueryClient()
  const { canParticipate, canLancarResultadoOficial } = useAuth()

  const { data: jogosCrono = [], isLoading: loadingJogos, isError: jogosError, refetch: refetchJogos } = useQuery({
    queryKey: ['jogos', 'cronologico'],
    queryFn: () => api.get<Jogo[]>('/jogos/cronologico'),
    staleTime: 10_000,
  })

  const { data: palpites = [] } = useQuery({
    queryKey: ['palpites', 'me'],
    queryFn: () => api.get<PalpiteJogo[]>('/palpites-jogos/me'),
    enabled: canParticipate,
    staleTime: 10_000,
  })

  const { data: configBolao } = useQuery({
    queryKey: ['configuracao-bolao', 'minha'],
    queryFn: () => api.get<ConfiguracaoBolao>('/configuracao-bolao/minha'),
    enabled: canParticipate,
    staleTime: Infinity,
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

  const {
    data: tabelaGrupo = [],
    isLoading: loadingTabelaGrupo,
    isError: tabelaGrupoError,
    refetch: refetchTabelaGrupo,
  } = useQuery({
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
    } catch (err) {
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

  const jogosCronoPendentesOficial = jogosOrdenadosAsc.filter((jogo) => !jogo.finalizado)
  const jogosCronoFinalizadosOficial = [...jogosOrdenadosAsc.filter((jogo) => jogo.finalizado)].reverse()

  const filtrarPorStatus = (jogos: Jogo[]) => {
    if (filtroStatus === 'abertos') {
      return jogos.filter((jogo) => isJogoAberto(jogo))
    }
    if (filtroStatus === 'fechados') {
      return [...jogos.filter((jogo) => isJogoFechado(jogo) || isJogoFinalizado(jogo))].reverse()
    }
    return jogos.filter((jogo) => palpiteMap.has(jogo.id))
  }

  const jogosCronoFiltrados = filtrarPorStatus(jogosOrdenadosAsc)

  const jogosDoGrupoSelecionado = jogosOrdenadosAsc.filter(
    (jogo) => jogo.tipo_fase === 'grupos' && (jogo.grupo || '').toUpperCase() === grupoSelecionado,
  )

  const jogosDoGrupoFiltrados = filtrarPorStatus(jogosDoGrupoSelecionado)

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
            { key: 'abertos' as OwnerStatusFiltro, label: 'Pendentes' },
            { key: 'fechados' as OwnerStatusFiltro, label: 'Finalizados' },
          ]}
          value={ownerFiltroStatus}
          onChange={setOwnerFiltroStatus}
          controlId="owner-resultados"
        />

      {loadingJogos ? (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : jogosError ? (
          <EmptyState
            icon={<CalendarDays size={28} style={{ color: 'var(--text-muted)' }} />}
            title="Não foi possível carregar os jogos"
            description="Verifique sua conexão e tente novamente."
            action={
              <button
                type="button"
                onClick={() => void refetchJogos()}
                className="text-sm font-medium"
                style={{ color: 'var(--accent)' }}
              >
                Tentar novamente
              </button>
            }
          />
        ) : jogosCrono.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={28} style={{ color: 'var(--text-muted)' }} />}
            title="Nenhum jogo cadastrado"
            description="Os jogos aparecerão aqui quando forem adicionados."
          />
        ) : (
          <OfficialResultsPanel
            jogos={ownerFiltroStatus === 'abertos' ? jogosCronoPendentesOficial : jogosCronoFinalizadosOficial}
            readOnly={ownerFiltroStatus === 'fechados'}
            showFlags
            showDateFilter={ownerFiltroStatus === 'abertos'}
            showFaseFilter={ownerFiltroStatus === 'abertos'}
            showGrupoFilter={ownerFiltroStatus === 'abertos'}
            groupByGrupo={ownerFiltroStatus === 'abertos'}
            allowEditMetadata={ownerFiltroStatus === 'abertos'}
            emptyMessage={
              ownerFiltroStatus === 'abertos'
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

  const emptyCopy =
    filtroStatus === 'abertos'
      ? {
          title: 'Nenhum jogo em aberto',
          description: 'Você não tem jogos abertos para preencher no momento.',
        }
      : filtroStatus === 'fechados'
        ? {
            title: 'Nenhum jogo fechado',
            description: 'Os jogos fechados ou finalizados aparecerão aqui.',
          }
        : {
            title: 'Nenhum palpite salvo',
            description: 'Salve placares para vê-los nesta lista.',
          }

  const segmentosAtivos = tab === 'cronologico' ? segmentosCrono : segmentosGrupo
  const segmentoAtivo = tab === 'cronologico' ? segmentoCronoAtivo : segmentoGrupoAtivo
  const onSegmentoChange = tab === 'cronologico' ? setSegmentoCrono : setSegmentoGrupo
  const jogosVisiveis = tab === 'cronologico' ? jogosCronoNaFase : jogosGrupoNaFase
  const listaFiltradaVazia =
    tab === 'cronologico' ? jogosCronoFiltrados.length === 0 : jogosDoGrupoFiltrados.length === 0

  return (
    <div className="space-y-4">
      <SectionHeader title="Palpites" subtitle="Faça seus palpites antes do fechamento" />

      {loadingJogos ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <GameCardSkeleton key={i} />)}
        </div>
      ) : jogosError ? (
        <EmptyState
          icon={<CalendarDays size={28} style={{ color: 'var(--text-muted)' }} />}
          title="Não foi possível carregar os jogos"
          description="Verifique sua conexão e tente novamente."
          action={
            <button
              type="button"
              onClick={() => void refetchJogos()}
              className="text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Tentar novamente
            </button>
          }
        />
      ) : jogosCrono.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} style={{ color: 'var(--text-muted)' }} />}
          title="Nenhum jogo cadastrado"
          description="Os jogos aparecerão aqui quando forem adicionados."
        />
      ) : (
        <div className="space-y-3">
          <JogosFilters
            tab={tab}
            onTabChange={setTab}
            filtroStatus={filtroStatus}
            onFiltroStatusChange={setFiltroStatus}
            segmentos={segmentosAtivos}
            segmentoAtivo={segmentoAtivo}
            onSegmentoChange={onSegmentoChange}
            gruposDisponiveis={gruposDisponiveis}
            grupoSelecionado={grupoSelecionado}
            onGrupoChange={setGrupoSelecionado}
          />

          {tab === 'grupos' && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--accent)' }}>
                Classificação do Grupo {grupoSelecionado}
              </h3>
              <p className="text-xs mb-3 px-1" style={{ color: 'var(--text-muted)' }}>
                Classificação calculada com base nos resultados oficiais cadastrados.
              </p>
              {loadingTabelaGrupo ? (
                <GroupStandingsTable
                  grupoSelecionado={grupoSelecionado}
                  tabela={tabelaGrupo}
                  isLoading
                />
              ) : tabelaGrupoError ? (
                <EmptyState
                  icon={<CalendarDays size={26} style={{ color: 'var(--text-muted)' }} />}
                  title="Não foi possível carregar a classificação"
                  description="Verifique sua conexão e tente novamente."
                  action={
                    <button
                      type="button"
                      onClick={() => void refetchTabelaGrupo()}
                      className="text-sm font-medium"
                      style={{ color: 'var(--accent)' }}
                    >
                      Tentar novamente
                    </button>
                  }
                />
              ) : (
                <GroupStandingsTable
                  grupoSelecionado={grupoSelecionado}
                  tabela={tabelaGrupo}
                />
              )}
            </div>
          )}

          {tab === 'grupos' && (
            <h3 className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: 'var(--accent)' }}>
              Palpites do Grupo {grupoSelecionado}
            </h3>
          )}

          {listaFiltradaVazia ? (
            <EmptyState
              icon={<CalendarDays size={26} style={{ color: 'var(--text-muted)' }} />}
              title={emptyCopy.title}
              description={emptyCopy.description}
            />
          ) : (
            <div className="space-y-3">
              {jogosVisiveis.map((jogo) => (
                <GameCard
                  key={jogo.id}
                  jogo={jogo}
                  palpite={palpiteMap.get(jogo.id) ?? null}
                  todosJogos={jogosCrono}
                  showStatusBadge={filtroStatus === 'meus_palpites'}
                  onSave={handleSave}
                  onSaveMarcadores={marcadoresBrasilHabilitado ? handleSaveMarcadores : undefined}
                  candidatos={candidatos}
                  marcadoresBrasilHabilitado={marcadoresBrasilHabilitado}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
