import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Medal } from 'lucide-react'
import { api } from '@/lib/api'
import { RankingCardSkeleton } from '@/components/Skeleton'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'
import { imgUrl, getInitials } from '@/lib/utils'
import type { RankingResponse } from '@/types'
import { useAuth } from '@/features/auth/AuthContext'

const podiumColors = [
  { color: '#F6C65B', shadow: 'rgba(246,198,91,0.3)', label: '1º' },
  { color: '#A7B0C0', shadow: 'rgba(167,176,192,0.2)', label: '2º' },
  { color: '#CD7F32', shadow: 'rgba(205,127,50,0.2)', label: '3º' },
]

export function RankingPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['ranking'],
    queryFn: () => api.get<RankingResponse>('/ranking'),
  })

  const linhas = data?.linhas ?? []
  const top3 = linhas.slice(0, 3)
  const rest = linhas.slice(3)

  const myPosition = linhas.findIndex((l) => l.usuario_id === user?.id)

  return (
    <div className="space-y-4">
      <SectionHeader title="Ranking" subtitle="Classificação geral do bolão" />

      {/* My position highlight (if not top 3) */}
      {myPosition >= 3 && !isLoading && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: 'rgba(53,208,127,0.08)',
            border: '1px solid rgba(53,208,127,0.25)',
          }}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
            Sua posição: #{myPosition + 1}
          </span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {linhas[myPosition]?.pontos_totais} pts
          </span>
        </div>
      )}

      {isLoading ? (
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
            <div className="flex gap-2 mb-4">
              {top3.map((linha, i) => {
                const p = podiumColors[i]
                const isMe = linha.usuario_id === user?.id
                return (
                  <motion.div
                    key={linha.usuario_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.06 }}
                    className="flex-1 flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl text-center"
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
                    {i === 0 && <Medal size={14} style={{ color: p.color }} />}
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Rest */}
          {rest.map((linha, i) => {
            const isMe = linha.usuario_id === user?.id
            return (
              <motion.div
                key={linha.usuario_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: (i + top3.length) * 0.04 }}
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
                  <p className="font-semibold text-sm truncate">{linha.nome}</p>
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
        </div>
      )}
    </div>
  )
}
