import { motion } from 'framer-motion'
import { CountryFlag } from '@/components/CountryFlag'
import type { GrupoTabela, Pais } from '@/types'

interface GroupStandingsTableProps {
  grupoSelecionado: string
  tabela: GrupoTabela[]
  isLoading?: boolean
}

export function GroupStandingsTable({ grupoSelecionado, tabela, isLoading = false }: GroupStandingsTableProps) {
  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4 animate-pulse space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
        ))}
      </div>
    )
  }

  if (!tabela.length) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Nenhum dado para o grupo {grupoSelecionado}
        </p>
      </div>
    )
  }

  return (
    <motion.div
      key={grupoSelecionado}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div
        className="grid items-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
        style={{
          gridTemplateColumns: '1.75rem 1fr 2.75rem 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 3rem 2.75rem',
          gap: '0.25rem',
          color: 'var(--text-muted)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span>#</span>
        <span>Seleção</span>
        <span className="text-center font-black" style={{ color: 'var(--text)' }}>Pts</span>
        <span className="text-center">J</span>
        <span className="text-center hidden sm:block">V</span>
        <span className="text-center hidden sm:block">E</span>
        <span className="text-center hidden sm:block">D</span>
        <span className="text-center">SG</span>
        <span className="text-center">GP</span>
        <span className="text-center hidden sm:block">GC</span>
      </div>

      {tabela.map((row, i) => (
        // Adapt backend table line to CountryFlag props.
        // Classification data is still sourced from official backend results.
        (() => {
          const pais: Pais = {
            id: row.pais_id,
            nome: row.nome,
            sigla: row.sigla,
            grupo: grupoSelecionado,
            bandeira_url: row.bandeira_url,
          }

          return (
        <motion.div
          key={row.pais_id ?? i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15, delay: i * 0.03 }}
          className="grid items-center px-4 py-3"
          style={{
            gridTemplateColumns: '1.75rem 1fr 2.75rem 2.5rem 2.5rem 2.5rem 2.5rem 2.5rem 3rem 2.75rem',
            gap: '0.25rem',
            borderBottom: i < tabela.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}
        >
          <span className="text-xs font-bold" style={{ color: i < 2 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {row.posicao}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <CountryFlag pais={pais} size="sm" />
            <span className="text-sm font-semibold truncate" title={row.nome}>
              {row.nome}
            </span>
          </div>
          <span className="text-sm font-black text-center" style={{ color: row.pontos > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
            {row.pontos}
          </span>
          <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{row.jogos}</span>
          <span className="text-xs text-center hidden sm:block" style={{ color: 'var(--text-muted)' }}>{row.vitorias}</span>
          <span className="text-xs text-center hidden sm:block" style={{ color: 'var(--text-muted)' }}>{row.empates}</span>
          <span className="text-xs text-center hidden sm:block" style={{ color: 'var(--text-muted)' }}>{row.derrotas}</span>
          <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{row.saldo_gols}</span>
          <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{row.gols_pro}</span>
          <span className="text-xs text-center hidden sm:block" style={{ color: 'var(--text-muted)' }}>{row.gols_contra}</span>
        </motion.div>
          )
        })()
      ))}
    </motion.div>
  )
}
