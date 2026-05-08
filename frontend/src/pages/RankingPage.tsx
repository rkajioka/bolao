import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, Star } from 'lucide-react'
import { useState } from 'react'
import { RankingCardSkeleton } from '@/components/Skeleton'
import { SegmentedControl } from '@/components/SegmentedControl'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'
import { imgUrl, getInitials } from '@/lib/utils'
import { CountryFlag } from '@/components/CountryFlag'
import { rankingService } from '@/services/ranking.service'
import type { Pais } from '@/types'
import { api } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthContext'

type Aba = 'classificacao' | 'insights'

const ABA_SEGMENTS = [
  { key: 'classificacao' as Aba, label: 'Classificação' },
  { key: 'insights' as Aba, label: 'Insights' },
]

const MEDAL_CONFIG = [
  { color: '#F6C65B', shadow: 'rgba(246,198,91,0.20)', rgb: '246,198,91', label: '1º', symbol: '🥇' },
  { color: '#A7B0C0', shadow: 'rgba(167,176,192,0.15)', rgb: '167,176,192', label: '2º', symbol: '🥈' },
  { color: '#CD7F32', shadow: 'rgba(205,127,50,0.15)', rgb: '205,127,50', label: '3º', symbol: '🥉' },
]

function Avatar({ src, alt, initials, size = 10 }: { src?: string | null; alt: string; initials: string; size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0`}
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      {src ? (
        <img src={imgUrl(src)} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{initials}</span>
      )}
    </div>
  )
}

export function RankingPage() {
  const { user } = useAuth()
  const [aba, setAba] = useState<Aba>('classificacao')

  const { data, isLoading } = useQuery({
    queryKey: ['ranking'],
    queryFn: () => rankingService.get(),
  })
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => api.get<Pais[]>('/paises'),
  })
  const { data: insights, isLoading: isLoadingInsights } = useQuery({
    queryKey: ['ranking', 'insights'],
    queryFn: () => rankingService.getInsights(),
  })

  const linhas = data?.linhas ?? []
  const top3 = linhas.slice(0, 3)
  const top50 = linhas.slice(0, 50)
  const listaTop50 = top50.slice(3)
  const linhaUsuario = linhas.find((l) => l.usuario_id === user?.id)
  const usuarioForaTop50 = Boolean(linhaUsuario && linhaUsuario.posicao > 50)
  const getPais = (id?: number | null) => paises.find((p) => p.id === id) ?? null
  const liderPts = top3[0]?.pontos_totais ?? 0

  const insightSemConteudo =
    !!insights &&
    insights.jogos_periodo === 0 &&
    insights.destaques_resultado.length === 0 &&
    insights.destaques_placar_exato.length === 0 &&
    insights.destaques_marcadores_br.length === 0

  return (
    <div className="space-y-4">
      <SectionHeader title="Ranking" subtitle="Classificação geral do bolão" />

      <SegmentedControl
        segments={ABA_SEGMENTS}
        value={aba}
        onChange={setAba}
        controlId="ranking-aba"
      />

      {/* Minha posição destaque */}
      {aba === 'classificacao' && linhaUsuario && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'rgba(53,208,127,0.06)',
            border: '1px solid rgba(53,208,127,0.28)',
          }}
          aria-label="Sua posição no ranking"
        >
          <div className="flex items-center justify-center w-9 shrink-0">
            <span className="text-lg font-black tabular-nums" style={{ color: 'var(--accent)' }}>
              #{linhaUsuario.posicao}
            </span>
          </div>
          <Avatar
            src={linhaUsuario.imagem_perfil}
            alt={linhaUsuario.nome}
            initials={getInitials(linhaUsuario.nome)}
            size={9}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{linhaUsuario.nome}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {linhaUsuario.posicao === 1
                ? `+${(listaTop50[0]?.pontos_totais != null ? linhaUsuario.pontos_totais - listaTop50[0].pontos_totais : 0)} do 2º`
                : `${liderPts - linhaUsuario.pontos_totais} pts atrás do líder`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--accent)' }}>
              {linhaUsuario.pontos_totais}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</p>
          </div>
        </motion.div>
      )}

      {aba === 'classificacao' && (isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando ranking">
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
          {/* Pódio compacto top 3 */}
          {top3.length > 0 && (
            <div className="flex gap-2 items-end mb-2" role="list" aria-label="Top 3 do ranking">
              {([1, 0, 2] as const).filter((idx) => top3[idx]).map((idx) => {
                const linha = top3[idx]
                const p = MEDAL_CONFIG[idx]
                const isMe = linha.usuario_id === user?.id
                const paisFlags = [linha.campeao_id, linha.vice_campeao_id, linha.terceiro_lugar_id]
                  .map((id) => getPais(id))
                  .filter(Boolean)
                  .slice(0, 2)

                const diffFromLeader = idx === 0
                  ? (top3[1] ? linha.pontos_totais - top3[1].pontos_totais : null)
                  : liderPts - linha.pontos_totais

                return (
                  <motion.div
                    key={linha.usuario_id}
                    role="listitem"
                    aria-label={`${p.label} lugar: ${linha.nome}, ${linha.pontos_totais} pontos`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: idx * 0.05 }}
                    className="flex-1 flex flex-col items-center justify-end gap-1 py-3 px-2 rounded-2xl text-center"
                    style={{
                      minHeight: idx === 0 ? '150px' : idx === 1 ? '130px' : '116px',
                      background: `rgba(${p.rgb},0.07)`,
                      border: `1px solid rgba(${p.rgb},${isMe ? '0.55' : '0.22'})`,
                      boxShadow: isMe ? `0 0 0 2px var(--accent), 0 0 12px rgba(53,208,127,0.12)` : 'none',
                    }}
                  >
                    <span className="text-base leading-none" aria-hidden="true">{p.symbol}</span>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: `2px solid ${p.color}`,
                      }}
                    >
                      {linha.imagem_perfil ? (
                        <img src={imgUrl(linha.imagem_perfil)} alt={linha.nome} className="w-full h-full object-cover" />
                      ) : (
                        <span style={{ color: p.color, fontSize: '11px' }}>{getInitials(linha.nome)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold truncate max-w-[80px]">{linha.nome.split(' ')[0]}</p>
                      <p className="text-lg font-black tabular-nums leading-tight mt-0.5" style={{ color: p.color }}>
                        {linha.pontos_totais}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>pts</p>
                    </div>
                    {diffFromLeader !== null && diffFromLeader > 0 && (
                      <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {idx === 0 ? `+${diffFromLeader} do 2º` : `-${diffFromLeader}`}
                      </p>
                    )}
                    {paisFlags.length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {paisFlags.map((pais) => (
                          <div key={pais!.id} title={pais!.nome}>
                            <CountryFlag pais={pais!} size="sm" />
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Posições 4..50 */}
          {listaTop50.map((linha, i) => {
            const isMe = linha.usuario_id === user?.id
            const diffDoLider = liderPts - linha.pontos_totais
            const prevPts = i === 0 ? top3[2]?.pontos_totais : listaTop50[i - 1]?.pontos_totais
            const diffDoPrev = prevPts != null ? prevPts - linha.pontos_totais : null

            return (
              <motion.div
                key={linha.usuario_id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18, delay: Math.min((i + 3) * 0.025, 0.4) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
                aria-label={`${linha.posicao}º lugar: ${linha.nome}, ${linha.pontos_totais} pontos`}
                style={{
                  background: isMe ? 'rgba(53,208,127,0.06)' : 'var(--glass)',
                  border: `1px solid ${isMe ? 'rgba(53,208,127,0.25)' : 'var(--border)'}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span
                  className="w-6 text-center font-bold text-sm tabular-nums shrink-0"
                  style={{ color: isMe ? 'var(--accent)' : 'var(--text-muted)', fontSize: '13px' }}
                >
                  {linha.posicao}
                </span>

                <Avatar
                  src={linha.imagem_perfil}
                  alt={linha.nome}
                  initials={getInitials(linha.nome)}
                  size={9}
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate leading-tight">
                    {linha.nome}
                    {isMe && <span style={{ color: 'var(--accent)' }}> · Você</span>}
                  </p>
                  <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {diffDoPrev !== null && diffDoPrev > 0 ? `-${diffDoPrev} pts` : ''}
                    {diffDoPrev !== null && diffDoPrev > 0 && diffDoLider > 0 ? ' · ' : ''}
                    {diffDoLider > 0 ? `${diffDoLider} do líder` : 'Líder'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-black text-base tabular-nums">{linha.pontos_totais}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    J:{linha.pontos_jogos} E:{linha.pontos_especiais}
                    {linha.bonus_brasil > 0 ? ` BR:${linha.bonus_brasil}` : ''}
                  </p>
                </div>
              </motion.div>
            )
          })}

          {/* Usuário fora do top 50 */}
          {usuarioForaTop50 && linhaUsuario && (
            <>
              <div className="text-center py-1">
                <span className="text-xs tracking-widest" style={{ color: 'var(--text-muted)' }}>· · ·</span>
              </div>
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
                style={{
                  background: 'rgba(53,208,127,0.06)',
                  border: '1px solid rgba(53,208,127,0.25)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span className="w-6 text-center font-bold text-sm tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
                  {linhaUsuario.posicao}
                </span>
                <Avatar
                  src={linhaUsuario.imagem_perfil}
                  alt={linhaUsuario.nome}
                  initials={getInitials(linhaUsuario.nome)}
                  size={9}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {linhaUsuario.nome} <span style={{ color: 'var(--accent)' }}>· Você</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {liderPts - linhaUsuario.pontos_totais > 0
                      ? `${liderPts - linhaUsuario.pontos_totais} pts atrás do líder`
                      : 'Fora do top 50'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-base tabular-nums">{linhaUsuario.pontos_totais}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>pts</p>
                </div>
              </motion.div>
            </>
          )}
        </div>
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
          ) : (
            <>
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

                {!insightSemConteudo ? (
                  <div className="space-y-2">
                    {insights.destaques_resultado[0] && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mais resultados</span>
                        <span className="text-xs font-semibold">
                          {insights.destaques_resultado[0].nome}
                          <span style={{ color: 'var(--accent)' }}> {insights.destaques_resultado[0].valor}</span>
                        </span>
                      </div>
                    )}
                    {insights.destaques_placar_exato[0] && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mais placares exatos</span>
                        <span className="text-xs font-semibold">
                          {insights.destaques_placar_exato[0].nome}
                          <span style={{ color: 'var(--highlight)' }}> {insights.destaques_placar_exato[0].valor}</span>
                        </span>
                      </div>
                    )}
                    {insights.destaques_marcadores_br[0] && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Bônus marcadores BR</span>
                        <span className="text-xs font-semibold">
                          {insights.destaques_marcadores_br[0].nome}
                          <span style={{ color: 'var(--highlight)' }}> {insights.destaques_marcadores_br[0].valor}</span>
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Ainda não há jogos finalizados no período atual para gerar destaques.
                  </p>
                )}
              </div>

              <div className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Star size={14} style={{ color: 'var(--highlight)' }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--highlight)' }}>
                    Meu período
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: insights.meus_pontos_periodo, label: 'pts no período', color: 'var(--accent)' },
                    { value: insights.meu_preenchidos, label: 'palpites', color: 'var(--text)' },
                    { value: insights.meu_acertos_placar_exato, label: 'placar exato', color: 'var(--highlight)' },
                    { value: insights.meu_acertos_resultado, label: 'resultados', color: 'var(--text)' },
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
                {insights.meu_bonus_marcadores_br > 0 && (
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    Bônus marcadores Brasil: +{insights.meu_bonus_marcadores_br}
                  </p>
                )}
              </div>

              <div className="glass rounded-2xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  Legenda
                </p>
                <div className="space-y-1">
                  {[
                    'J: Pontos de jogos',
                    'E: Pontos de especiais',
                    'BR: Bônus marcadores Brasil',
                  ].map((label) => (
                    <p key={label} className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
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
