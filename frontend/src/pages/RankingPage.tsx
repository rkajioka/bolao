import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Medal } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/lib/api'
import { RankingCardSkeleton } from '@/components/Skeleton'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'
import { imgUrl, getInitials } from '@/lib/utils'
import { CountryFlag } from '@/components/CountryFlag'
import type { RankingResponse, RankingInsights, Pais } from '@/types'
import { useAuth } from '@/features/auth/AuthContext'

const podiumColors = [
  { color: '#F6C65B', shadow: 'rgba(246,198,91,0.3)', label: '1º' },
  { color: '#A7B0C0', shadow: 'rgba(167,176,192,0.2)', label: '2º' },
  { color: '#CD7F32', shadow: 'rgba(205,127,50,0.2)', label: '3º' },
]

export function RankingPage() {
  const { user } = useAuth()
  const [aba, setAba] = useState<'classificacao' | 'insights'>('classificacao')
  const { data, isLoading } = useQuery({
    queryKey: ['ranking'],
    queryFn: () => api.get<RankingResponse>('/ranking'),
  })
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => api.get<Pais[]>('/paises'),
  })
  const { data: insights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['ranking', 'insights'],
    queryFn: () => api.get<RankingInsights>('/ranking/insights'),
  })

  const linhas = data?.linhas ?? []
  const top3 = linhas.slice(0, 3)
  const top50 = linhas.slice(0, 50)
  const listaTop50 = top50.slice(3)
  const linhaUsuario = linhas.find((l) => l.usuario_id === user?.id)
  const usuarioForaTop50 = Boolean(linhaUsuario && linhaUsuario.posicao > 50)
  const getPais = (id?: number | null) => paises.find((p) => p.id === id) ?? null
  const insightSemConteudo =
    !!insights &&
    insights.jogos_periodo === 0 &&
    insights.destaques_resultado.length === 0 &&
    insights.destaques_placar_exato.length === 0 &&
    insights.destaques_marcadores_br.length === 0

  return (
    <div className="space-y-4">
      <SectionHeader title="Ranking" subtitle="Classificação geral do bolão" />

      <div className="inline-flex rounded-xl p-1" style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setAba('classificacao')}
          className="px-3 py-1.5 text-sm rounded-lg font-semibold transition-colors"
          style={{
            background: aba === 'classificacao' ? 'rgba(53,208,127,0.12)' : 'transparent',
            color: aba === 'classificacao' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          Classificação
        </button>
        <button
          type="button"
          onClick={() => setAba('insights')}
          className="px-3 py-1.5 text-sm rounded-lg font-semibold transition-colors"
          style={{
            background: aba === 'insights' ? 'rgba(53,208,127,0.12)' : 'transparent',
            color: aba === 'insights' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          Insights
        </button>
      </div>

      {aba === 'classificacao' && linhaUsuario && !isLoading && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'rgba(53,208,127,0.06)',
            border: '1px solid rgba(53,208,127,0.30)',
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {linhaUsuario.imagem_perfil ? (
              <img src={imgUrl(linhaUsuario.imagem_perfil)} alt={linhaUsuario.nome} className="w-full h-full object-cover" />
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>{getInitials(linhaUsuario.nome)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
              Seu desempenho
            </p>
            <p className="text-sm font-semibold truncate">{linhaUsuario.nome}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Posição #{linhaUsuario.posicao}
            </p>
          </div>
          <span className="text-sm font-black" style={{ color: 'var(--accent)' }}>
            {linhaUsuario.pontos_totais} pts
          </span>
        </div>
      )}

      {aba === 'classificacao' && (isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <RankingCardSkeleton key={i} />)}
        </div>
      ) : linhas.length === 0 ? (
        <EmptyState
          icon={<Trophy size={28} style={{ color: 'var(--text-muted)' }} />}
          title="Ranking vazio"
          description="Os pontos aparecerão após os jogos serem finalizados."
        />
      ) : (
        <div className="space-y-2">
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="flex gap-2 mb-4 items-end">
              {[1, 0, 2].filter((idx) => top3[idx]).map((idx) => {
                const linha = top3[idx]
                const p = podiumColors[idx]
                const isMe = linha.usuario_id === user?.id
                const heightClass = idx === 0 ? 'min-h-[160px]' : idx === 1 ? 'min-h-[140px]' : 'min-h-[128px]'
                return (
                  <motion.div
                    key={linha.usuario_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.06 }}
                    className={`flex-1 flex flex-col items-center justify-end gap-1.5 py-4 px-2 rounded-2xl text-center ${heightClass}`}
                    style={{
                      background: `rgba(${p.color === '#F6C65B' ? '246,198,91' : p.color === '#A7B0C0' ? '167,176,192' : '205,127,50'},0.07)`,
                      border: `1px solid ${p.shadow.replace('0.3', '0.35').replace('0.2', '0.25')}`,
                      boxShadow: isMe ? `0 0 0 2px var(--accent)` : 'none',
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: p.color }}>{p.label}</span>
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: `2px solid ${p.color}`,
                      }}
                    >
                      {linha.imagem_perfil ? (
                        <img src={imgUrl(linha.imagem_perfil)} alt={linha.nome} className="w-full h-full object-cover" />
                      ) : (
                        <span style={{ color: p.color }}>{getInitials(linha.nome)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold truncate max-w-[80px]">{linha.nome.split(' ')[0]}</p>
                      <p className="text-base font-black mt-0.5" style={{ color: p.color }}>
                        {linha.pontos_totais}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[linha.campeao_id, linha.vice_campeao_id, linha.terceiro_lugar_id]
                        .map((id) => getPais(id))
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((pais) => (
                          <div key={pais!.id} title={pais!.nome}>
                            <CountryFlag pais={pais!} size="sm" />
                          </div>
                        ))}
                    </div>
                    {idx === 0 && <Medal size={14} style={{ color: p.color }} />}
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Positions 4..50 */}
          {listaTop50.map((linha, i) => {
            const isMe = linha.usuario_id === user?.id
            return (
              <motion.div
                key={linha.usuario_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: (i + 3) * 0.04 }}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: isMe ? 'rgba(53,208,127,0.06)' : 'var(--glass)',
                  border: `1px solid ${isMe ? 'rgba(53,208,127,0.25)' : 'var(--border)'}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span
                  className="w-7 text-center font-bold text-sm tabular-nums"
                  style={{ color: isMe ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {linha.posicao}
                </span>

                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden shrink-0"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  {linha.imagem_perfil ? (
                    <img src={imgUrl(linha.imagem_perfil)} alt={linha.nome} className="w-full h-full object-cover" />
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>{getInitials(linha.nome)}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {linha.nome} {isMe ? '· Você' : ''}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Jogos: {linha.pontos_jogos} · Especiais: {linha.pontos_especiais} · Brasil: {linha.bonus_brasil}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-black text-base">{linha.pontos_totais}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</p>
                </div>
              </motion.div>
            )
          })}

          {usuarioForaTop50 && linhaUsuario && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl mt-3"
              style={{
                background: 'rgba(53,208,127,0.06)',
                border: '1px solid rgba(53,208,127,0.25)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <span
                className="w-7 text-center font-bold text-sm tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                {linhaUsuario.posicao}
              </span>

              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {linhaUsuario.imagem_perfil ? (
                  <img src={imgUrl(linhaUsuario.imagem_perfil)} alt={linhaUsuario.nome} className="w-full h-full object-cover" />
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>{getInitials(linhaUsuario.nome)}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {linhaUsuario.nome} · Você
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Fora do top 50
                </p>
              </div>

              <div className="text-right shrink-0">
                <p className="font-black text-base">{linhaUsuario.pontos_totais}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</p>
              </div>
            </motion.div>
          )}

        </div>
      ))}

      {aba === 'insights' && (
        <div className="space-y-3">
          {isLoadingInsights ? (
            <div className="glass rounded-2xl p-4">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Carregando insights...
              </p>
            </div>
          ) : !insights ? (
            <div className="glass rounded-2xl p-4">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Insights indisponíveis no momento.
              </p>
            </div>
          ) : (
            <>
              <div className="glass rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>
                  Resumo geral
                </p>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Período: {insights.periodo_label} · {insights.jogos_periodo} jogos
                </p>
                <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <p>
                    Resultados: {insights.destaques_resultado[0] ? `${insights.destaques_resultado[0].nome} (${insights.destaques_resultado[0].valor})` : 'sem destaque no período'}
                  </p>
                  <p>
                    Placar exato: {insights.destaques_placar_exato[0] ? `${insights.destaques_placar_exato[0].nome} (${insights.destaques_placar_exato[0].valor})` : 'sem destaque no período'}
                  </p>
                  <p>
                    Marcadores BR: {insights.destaques_marcadores_br[0] ? `${insights.destaques_marcadores_br[0].nome} (${insights.destaques_marcadores_br[0].valor})` : 'sem destaque no período'}
                  </p>
                </div>
              </div>

              <div className="glass rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>
                  Meu resumo
                </p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No período atual, você preencheu {insights.meu_preenchidos} palpites e somou {insights.meus_pontos_periodo} pontos.
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Acertos de resultado: {insights.meu_acertos_resultado} · Placar exato: {insights.meu_acertos_placar_exato} · Bônus marcadores BR: {insights.meu_bonus_marcadores_br}
                </p>
                {insightSemConteudo && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Ainda não existem jogos finalizados no período atual para gerar destaques.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
