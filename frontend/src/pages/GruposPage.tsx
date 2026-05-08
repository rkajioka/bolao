import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { SectionHeader } from '@/components/SectionHeader'
import { GroupStandingsTable } from '@/components/GroupStandingsTable'
import type { GruposListResponse, TabelaGrupoResponse } from '@/types'

export function GruposPage() {
  const [grupoSelecionado, setGrupoSelecionado] = useState<string>('')

  const { data: grupos = [] } = useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      const resp = await api.get<GruposListResponse>('/grupos')
      return resp.grupos ?? []
    },
  })

  useEffect(() => {
    if (grupos.length && !grupoSelecionado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGrupoSelecionado(grupos[0])
    }
  }, [grupos, grupoSelecionado])

  const { data: tabela = [], isLoading } = useQuery({
    queryKey: ['grupos', 'tabela', grupoSelecionado],
    queryFn: async () => {
      const resp = await api.get<TabelaGrupoResponse>(`/grupos/${grupoSelecionado}/tabela`)
      return resp.linhas ?? []
    },
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

      <GroupStandingsTable grupoSelecionado={grupoSelecionado} tabela={tabela} isLoading={isLoading} />
    </div>
  )
}
