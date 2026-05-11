import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { empresaService } from '@/services/empresa.service'
import type { Empresa } from '@/types'

interface AdminEmpresasProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

export function AdminEmpresas({ success, error }: AdminEmpresasProps) {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
  })

  const criar = useMutation({
    mutationFn: () => empresaService.criar({ nome: nome.trim() }),
    onSuccess: async (empresa) => {
      setNome('')
      await queryClient.invalidateQueries({ queryKey: ['empresas', 'owner'] })
      success(
        `Empresa criada com o código ${empresa.codigo_empresa}. Cadastre o administrador em Usuários com a empresa vinculada.`,
      )
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao criar empresa')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      error('Informe o nome da empresa.')
      return
    }
    criar.mutate()
  }

  if (isLoading) {
    return (
      <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
        Carregando…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold">Nova empresa</p>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          O código da empresa é gerado automaticamente. Após criar, cadastre o administrador em Usuários com o
          papel admin e a empresa escolhida.
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--text)',
            }}
            maxLength={255}
            required
          />
        </label>
        <button
          type="submit"
          disabled={criar.isPending}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid rgba(53,208,127,0.35)',
            color: 'var(--accent)',
            opacity: criar.isPending ? 0.6 : 1,
          }}
        >
          {criar.isPending ? 'Criando…' : 'Criar empresa'}
        </button>
      </form>

      <EmpresasList empresas={empresas} />
    </div>
  )
}

function EmpresasList({ empresas }: { empresas: Empresa[] }) {
  if (empresas.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        Nenhuma empresa cadastrada ainda.
      </p>
    )
  }

  return (
    <div className="space-y-2" role="list" aria-label="Empresas cadastradas">
      {empresas.map((emp) => (
        <div
          key={emp.id}
          className="glass rounded-2xl p-4 flex items-center justify-between gap-3"
          role="listitem"
        >
          <div>
            <p className="font-semibold text-sm">{emp.nome}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Código: {emp.codigo_empresa}
            </p>
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            style={{
              background: emp.ativo ? 'var(--accent-dim)' : 'var(--danger-dim)',
              color: emp.ativo ? 'var(--accent)' : 'var(--danger)',
              border: `1px solid ${emp.ativo ? 'rgba(53,208,127,0.3)' : 'rgba(255,92,122,0.3)'}`,
            }}
          >
            {emp.ativo ? 'Ativa' : 'Inativa'}
          </span>
        </div>
      ))}
    </div>
  )
}
