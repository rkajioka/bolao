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
import { CalendarDays } from 'lucide-react'

type Tab = 'cronologico' | 'grupos'

export function JogosPage() {
  const [tab, setTab] = useState<Tab>('cronologico')
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>('A')
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
              {jogosCrono.map((jogo) => (
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

                {jogosDoGrupoSelecionado.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Nenhum jogo encontrado para o grupo {grupoSelecionado}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jogosDoGrupoSelecionado.map((jogo) => (
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
