import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { SectionHeader } from '@/components/SectionHeader'
import { CountryFlag } from '@/components/CountryFlag'
import type { GrupoTabela } from '@/types'

type GruposResponse = string[]

export function GruposPage() {
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>('')

  const { data: grupos = [] } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => api.get<GruposResponse>('/grupos'),
  })

  useEffect(() => {
    if (grupos.length && !grupoSelecionado) {
      setGrupoSelecionado(grupos[0])
    }
  }, [grupos, grupoSelecionado])

  const { data: tabela = [], isLoading } = useQuery({
    queryKey: ['grupos', 'tabela', grupoSelecionado],
    queryFn: () => api.get<GrupoTabela[]>(`/grupos/${grupoSelecionado}/tabela`),
    enabled: !!grupoSelecionado,
  })

  return (
    <div className="space-y-4">
      <SectionHeader title="Grupos" subtitle="Classificação das chaves" />

      {/* Group selector */}
      {grupos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {grupos.map((g) => (
            <button
              key={g}
              onClick={() => setGrupoSelecionado(g)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150"
              style={{
                background: grupoSelecionado === g ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${grupoSelecionado === g ? 'var(--accent)' : 'rgba(255,255,255,0.10)'}`,
                color: grupoSelecionado === g ? '#070A12' : 'var(--text-muted)',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="glass rounded-2xl p-4 animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
          ))}
        </div>
      ) : tabela.length > 0 ? (
        <motion.div
          key={grupoSelecionado}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="glass rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div
            className="grid px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
            style={{
              gridTemplateColumns: '1.5rem 1fr 2rem 2rem 2rem 2rem 2rem 2rem 2.5rem',
              gap: '0.5rem',
              color: 'var(--text-muted)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span>#</span>
            <span>País</span>
            <span className="text-center">J</span>
            <span className="text-center">V</span>
            <span className="text-center">E</span>
            <span className="text-center">D</span>
            <span className="text-center">SG</span>
            <span className="text-center">GP</span>
            <span className="text-center font-black" style={{ color: 'var(--text)' }}>Pts</span>
          </div>

          {tabela.map((row, i) => (
            <motion.div
              key={row.pais?.id ?? i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15, delay: i * 0.04 }}
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: '1.5rem 1fr 2rem 2rem 2rem 2rem 2rem 2rem 2.5rem',
                gap: '0.5rem',
                borderBottom: i < tabela.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <span
                className="text-xs font-bold"
                style={{ color: i < 2 ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {i + 1}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                {row.pais && <CountryFlag pais={row.pais} size="sm" />}
                <span className="text-sm font-semibold truncate">{row.pais?.nome}</span>
              </div>
              {[row.jogos, row.vitorias, row.empates, row.derrotas, row.saldo, row.gols_pro].map((val, j) => (
                <span key={j} className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  {val}
                </span>
              ))}
              <span
                className="text-sm font-black text-center"
                style={{ color: row.pontos > 0 ? 'var(--text)' : 'var(--text-muted)' }}
              >
                {row.pontos}
              </span>
            </motion.div>
          ))}
        </motion.div>
      ) : grupoSelecionado ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum dado para o grupo {grupoSelecionado}
          </p>
        </div>
      ) : null}
    </div>
  )
}
