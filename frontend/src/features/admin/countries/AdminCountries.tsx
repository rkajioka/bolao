import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CountryFlag } from '@/components/CountryFlag'
import type { Pais } from '@/types'
import { adminService } from '@/services/admin.service'

interface AdminCountriesProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--text)',
  borderRadius: '0.75rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
} as const

export function AdminCountries({ success, error }: AdminCountriesProps) {
  const queryClient = useQueryClient()
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', sigla: '', grupo: '', bandeira_url: '' })

  const { data: paises = [], isLoading } = useQuery({
    queryKey: ['paises'],
    queryFn: () => adminService.getPaises(),
  })

  const startEdit = (p: Pais) => {
    setEditId(p.id)
    setEditForm({ nome: p.nome, sigla: p.sigla, grupo: p.grupo || '', bandeira_url: p.bandeira_url || '' })
  }

  const saveEdit = async () => {
    if (!editId) return
    try {
      await adminService.updatePais(editId, editForm)
      await queryClient.invalidateQueries({ queryKey: ['paises'] })
      success('País atualizado')
      setEditId(null)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    }
  }

  if (isLoading) return (
    <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
      Carregando…
    </div>
  )

  return (
    <div className="space-y-2">
      {paises.map((p) => (
        <div key={p.id} className="glass rounded-2xl p-4">
          {editId === p.id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editForm.nome}
                  onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome"
                  aria-label="Nome do país"
                  style={inputStyle}
                />
                <input
                  value={editForm.sigla}
                  onChange={(e) => setEditForm((f) => ({ ...f, sigla: e.target.value }))}
                  placeholder="Sigla"
                  aria-label="Sigla do país"
                  style={inputStyle}
                />
                <input
                  value={editForm.grupo}
                  onChange={(e) => setEditForm((f) => ({ ...f, grupo: e.target.value }))}
                  placeholder="Grupo"
                  aria-label="Grupo do país"
                  style={inputStyle}
                />
                <input
                  value={editForm.bandeira_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, bandeira_url: e.target.value }))}
                  placeholder="URL bandeira"
                  aria-label="URL da bandeira"
                  style={inputStyle}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--accent)', color: '#070A12' }}
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CountryFlag pais={p} size="md" />
              <div className="flex-1">
                <p className="font-semibold text-sm">{p.nome}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.sigla}{p.grupo ? ` · Grupo ${p.grupo}` : ''}
                </p>
              </div>
              <button
                onClick={() => startEdit(p)}
                aria-label={`Editar ${p.nome}`}
                className="text-xs px-3 py-1.5 rounded-xl font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
              >
                Editar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
