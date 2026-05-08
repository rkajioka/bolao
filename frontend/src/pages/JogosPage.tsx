import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { GameCard } from '@/components/GameCard'
import { GameCardSkeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { SectionHeader } from '@/components/SectionHeader'
import { GroupStandingsTable } from '@/components/GroupStandingsTable'
import { useToast } from '@/components/Toast'
import type {
  Jogo,
  PalpiteJogo,
  Pais,
  MarcadorCandidato,
  GrupoTabela,
  GruposListResponse,
  TabelaGrupoResponse,
} from '@/types'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { jogoBloqueado, momentoFimEdicao } from '@/lib/utils'

type Tab = 'cronologico' | 'grupos'
type CronoFiltro = 'pendentes' | 'resultados' | 'todos'

export function JogosPage() {
  const [tab, setTab] = useState<Tab>('cronologico')
  const [filtroCrono, setFiltroCrono] = useState<CronoFiltro>('pendentes')
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>('A')
  const [secoesTodosAbertas, setSecoesTodosAbertas] = useState({
    abertos: true,
    fechados: false,
    finalizados: false,
  })
  const { success, error } = useToast()
  const queryClient = useQueryClient()

  const { data: jogosCrono = [], isLoading: loadingJogos } = useQuery({
    queryKey: ['jogos', 'cronologico'],
    queryFn: () => api.get<Jogo[]>('/jogos/cronologico'),
  })

  const { data: palpites = [] } = useQuery({
    queryKey: ['palpites', 'me'],
    queryFn: () => api.get<PalpiteJogo[]>('/palpites-jogos/me'),
  })

  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => api.get<Pais[]>('/paises'),
  })

  const { data: candidatos = [] } = useQuery({
    queryKey: ['marcadores', 'candidatos'],
    queryFn: () => api.get<MarcadorCandidato[]>('/marcadores-brasil/candidatos'),
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
      setGrupoSelecionado(gruposDisponiveis[0])
    }
  }, [gruposDisponiveis, grupoSelecionado])

  const handleSave = async (
    jogoId: number,
    casa: number,
    fora: number,
    classificado?: number | null,
  ) => {
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
      success('Palpite salvo!')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar palpite')
      throw err
    }
  }

  const handleSaveMarcadores = async (
    jogoId: number,
    marcadores: { nome_jogador: string; quantidade_gols: number }[],
  ) => {
    const existing = palpiteMap.get(jogoId)
    if (!existing) return
    try {
      await api.put(`/marcadores-brasil/${jogoId}`, { marcadores })
      success('Marcadores salvos!')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar marcadores')
      throw err
    }
  }

  const jogosDoGrupoSelecionado = jogosCrono.filter(
    (jogo) => jogo.tipo_fase === 'grupos' && (jogo.grupo || '').toUpperCase() === grupoSelecionado,
  )
  const isJogoAberto = (jogo: Jogo) => !jogoBloqueado(jogo, jogosCrono)
  const isJogoFinalizado = (jogo: Jogo) =>
    jogo.finalizado || (jogo.placar_casa !== null && jogo.placar_fora !== null)
  const isJogoFechado = (jogo: Jogo) => !isJogoAberto(jogo) && !isJogoFinalizado(jogo)

  const jogosParaPreencher = [...jogosCrono]
    .filter((jogo) => isJogoAberto(jogo))
    .sort((a, b) => momentoFimEdicao(a, jogosCrono) - momentoFimEdicao(b, jogosCrono))

  const jogosResultados = [...jogosCrono]
    .filter((jogo) => isJogoFinalizado(jogo))
    .sort((a, b) => new Date(b.data_jogo).getTime() - new Date(a.data_jogo).getTime())

  const jogosTodosAbertos = [...jogosCrono]
    .filter((jogo) => isJogoAberto(jogo))
    .sort((a, b) => momentoFimEdicao(a, jogosCrono) - momentoFimEdicao(b, jogosCrono))

  const jogosTodosFechados = [...jogosCrono]
    .filter((jogo) => isJogoFechado(jogo))
    .sort((a, b) => new Date(a.data_jogo).getTime() - new Date(b.data_jogo).getTime())

  const jogosTodosFinalizados = [...jogosCrono]
    .filter((jogo) => isJogoFinalizado(jogo))
    .sort((a, b) => new Date(b.data_jogo).getTime() - new Date(a.data_jogo).getTime())

  const jogosDoGrupoOrdenados = [...jogosDoGrupoSelecionado].sort((a, b) => {
    const peso = (j: Jogo) => (isJogoAberto(j) ? 0 : isJogoFinalizado(j) ? 2 : 1)
    const diff = peso(a) - peso(b)
    if (diff !== 0) return diff
    return new Date(a.data_jogo).getTime() - new Date(b.data_jogo).getTime()
  })

  const candidatoNames = candidatos.map((c) => c.nome)

  return (
    <div className="space-y-4">
      <SectionHeader title="Palpites" subtitle="Faça seus palpites antes do fechamento" />

      {/* Tab switcher */}
      <div
        className="flex p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {(['cronologico', 'grupos'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              background: tab === t ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            {t === 'cronologico' ? 'Cronológico' : 'Por grupo'}
          </button>
        ))}
      </div>

      {tab === 'cronologico' && (
        <div
          className="flex p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {([
            { key: 'pendentes', label: 'Para preencher' },
            { key: 'resultados', label: 'Resultados' },
            { key: 'todos', label: 'Todos' },
          ] as { key: CronoFiltro; label: string }[]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFiltroCrono(opt.key)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
              style={{
                background: filtroCrono === opt.key ? 'rgba(255,255,255,0.10)' : 'transparent',
                color: filtroCrono === opt.key ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

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
        <AnimatePresence mode="wait">
          {tab === 'cronologico' ? (
            <motion.div
              key="crono"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {filtroCrono === 'pendentes' && (
                jogosParaPreencher.length === 0 ? (
                  <EmptyState
                    icon={<CalendarDays size={26} style={{ color: 'var(--text-muted)' }} />}
                    title="Nenhum palpite pendente"
                    description="Você não tem jogos abertos para preencher no momento."
                  />
                ) : (
                  jogosParaPreencher.map((jogo) => (
                    <GameCard
                      key={jogo.id}
                      jogo={jogo}
                      palpite={palpiteMap.get(jogo.id) ?? null}
                      todosJogos={jogosCrono}
                      paises={paises}
                      onSave={handleSave}
                      onSaveMarcadores={handleSaveMarcadores}
                      candidatos={candidatoNames}
                    />
                  ))
                )
              )}

              {filtroCrono === 'resultados' && (
                jogosResultados.length === 0 ? (
                  <EmptyState
                    icon={<CalendarDays size={26} style={{ color: 'var(--text-muted)' }} />}
                    title="Sem resultados ainda"
                    description="Os jogos finalizados aparecerão aqui para consulta."
                  />
                ) : (
                  jogosResultados.map((jogo) => (
                    <GameCard
                      key={jogo.id}
                      jogo={jogo}
                      palpite={palpiteMap.get(jogo.id) ?? null}
                      todosJogos={jogosCrono}
                      paises={paises}
                      onSave={handleSave}
                      onSaveMarcadores={handleSaveMarcadores}
                      candidatos={candidatoNames}
                    />
                  ))
                )
              )}

              {filtroCrono === 'todos' && (
                <div className="space-y-4">
                  {[
                    { key: 'abertos' as const, titulo: 'Abertos para palpite', jogos: jogosTodosAbertos },
                    { key: 'fechados' as const, titulo: 'Fechados', jogos: jogosTodosFechados },
                    { key: 'finalizados' as const, titulo: 'Finalizados', jogos: jogosTodosFinalizados },
                  ].map((secao) => (
                    <div key={secao.key} className="glass rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setSecoesTodosAbertas((prev) => ({ ...prev, [secao.key]: !prev[secao.key] }))
                        }
                        className="w-full flex items-center gap-2 px-4 py-3"
                        style={{ borderBottom: secoesTodosAbertas[secao.key] ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                      >
                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                          {secao.titulo}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                          {secao.jogos.length}
                        </span>
                        <ChevronDown
                          size={16}
                          className="ml-auto transition-transform duration-200"
                          style={{ transform: secoesTodosAbertas[secao.key] ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {secoesTodosAbertas[secao.key] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="p-3 space-y-3">
                              {secao.jogos.length === 0 ? (
                                <p className="text-sm px-2 py-3" style={{ color: 'var(--text-muted)' }}>
                                  Nenhum jogo nesta seção.
                                </p>
                              ) : (
                                secao.jogos.map((jogo) => (
                                  <GameCard
                                    key={jogo.id}
                                    jogo={jogo}
                                    palpite={palpiteMap.get(jogo.id) ?? null}
                                    todosJogos={jogosCrono}
                                    paises={paises}
                                    onSave={handleSave}
                                    onSaveMarcadores={handleSaveMarcadores}
                                    candidatos={candidatoNames}
                                  />
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="grupos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-7 pt-2"
            >
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

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--accent)' }}>
                  Palpites do Grupo {grupoSelecionado}
                </h3>

                {jogosDoGrupoOrdenados.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Nenhum jogo encontrado para o grupo {grupoSelecionado}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jogosDoGrupoOrdenados.map((jogo) => (
                      <GameCard
                        key={jogo.id}
                        jogo={jogo}
                        palpite={palpiteMap.get(jogo.id) ?? null}
                        todosJogos={jogosCrono}
                        paises={paises}
                        onSave={handleSave}
                        onSaveMarcadores={handleSaveMarcadores}
                        candidatos={candidatoNames}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
