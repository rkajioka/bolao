import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { empresaService } from '@/services/empresa.service'
import type { Empresa } from '@/types'

interface AdminEmpresasProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

export function AdminEmpresas({ success, error }: AdminEmpresasProps) {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')
  const [marcadoresBrasilHabilitado, setMarcadoresBrasilHabilitado] = useState(false)

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
  })

  const criar = useMutation({
    mutationFn: () =>
      empresaService.criar({
        nome: nome.trim(),
        marcadores_brasil_habilitado: marcadoresBrasilHabilitado,
      }),
    onSuccess: async (empresa) => {
      setNome('')
      setMarcadoresBrasilHabilitado(false)
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
        <label className="flex items-start gap-3 rounded-xl p-3 cursor-pointer" style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}>
          <input
            type="checkbox"
            checked={marcadoresBrasilHabilitado}
            onChange={(e) => setMarcadoresBrasilHabilitado(e.target.checked)}
            className="mt-0.5"
          />
          <span className="space-y-1">
            <span className="block text-sm font-semibold">Bônus por marcadores do Brasil</span>
            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
              A lista de jogadores candidatos é global (Torneio → Jogos). Com o bônus ativo, o admin da empresa define os pontos na configuração de pontuação.
            </span>
          </span>
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

      <EmpresasList empresas={empresas} success={success} error={error} />
    </div>
  )
}

function EmpresasList({
  empresas,
  success,
  error,
}: {
  empresas: Empresa[]
  success: (msg: string) => void
  error: (msg: string) => void
}) {
  const queryClient = useQueryClient()
  const [marcadoresPendente, setMarcadoresPendente] = useState<{
    id: number
    nome: string
    habilitado: boolean
  } | null>(null)

  const atualizarMarcadores = useMutation({
    mutationFn: ({ id, habilitado }: { id: number; habilitado: boolean }) =>
      empresaService.atualizar(id, { marcadores_brasil_habilitado: habilitado }),
    onSuccess: async (_empresa, { habilitado }) => {
      setMarcadoresPendente(null)
      await queryClient.invalidateQueries({ queryKey: ['empresas', 'owner'] })
      await queryClient.invalidateQueries({ queryKey: ['configuracao-bolao'] })
      success(
        habilitado
          ? 'Bônus de marcadores do Brasil ativado para a empresa.'
          : 'Bônus de marcadores do Brasil desativado. O ranking será recalculado sem esse bônus.',
      )
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao atualizar empresa')
    },
  })

  if (empresas.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        Nenhuma empresa cadastrada ainda.
      </p>
    )
  }

  const pendenteAtivar = marcadoresPendente?.habilitado === true

  return (
    <>
      <ConfirmDialog
        open={marcadoresPendente !== null}
        title={pendenteAtivar ? 'Ativar bônus de marcadores?' : 'Desativar bônus de marcadores?'}
        description={
          marcadoresPendente
            ? pendenteAtivar
              ? `Em ${marcadoresPendente.nome}, participantes poderão palpitar marcadores do Brasil. A lista de jogadores é global; o admin da empresa define os pontos na configuração de pontuação.`
              : `Em ${marcadoresPendente.nome}, o ranking será recalculado sem pontos de marcadores do Brasil. Palpites antigos permanecem salvos, mas deixam de valer até você reativar o bônus.`
            : ''
        }
        confirmLabel={pendenteAtivar ? 'Ativar bônus' : 'Desativar bônus'}
        tone={pendenteAtivar ? 'default' : 'warning'}
        confirming={atualizarMarcadores.isPending}
        onCancel={() => {
          if (!atualizarMarcadores.isPending) setMarcadoresPendente(null)
        }}
        onConfirm={() => {
          if (!marcadoresPendente) return
          atualizarMarcadores.mutate({
            id: marcadoresPendente.id,
            habilitado: marcadoresPendente.habilitado,
          })
        }}
      />
    <div className="space-y-2" role="list" aria-label="Empresas cadastradas">
      {empresas.map((emp) => (
        <div
          key={emp.id}
          className="glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          role="listitem"
        >
          <div>
            <p className="font-semibold text-sm">{emp.nome}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Código: {emp.codigo_empresa}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: emp.ativo ? 'var(--accent-dim)' : 'var(--danger-dim)',
                color: emp.ativo ? 'var(--accent)' : 'var(--danger)',
                border: `1px solid ${emp.ativo ? 'rgba(53,208,127,0.3)' : 'rgba(255,92,122,0.3)'}`,
              }}
            >
              {emp.ativo ? 'Ativa' : 'Inativa'}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: emp.marcadores_brasil_habilitado ? 'rgba(53,208,127,0.12)' : 'rgba(255,255,255,0.06)',
                color: emp.marcadores_brasil_habilitado ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${emp.marcadores_brasil_habilitado ? 'rgba(53,208,127,0.25)' : 'rgba(255,255,255,0.10)'}`,
              }}
            >
              Marcadores BR: {emp.marcadores_brasil_habilitado ? 'Ativo' : 'Inativo'}
            </span>
            <button
              type="button"
              disabled={atualizarMarcadores.isPending}
              onClick={() => {
                setMarcadoresPendente({
                  id: emp.id,
                  nome: emp.nome,
                  habilitado: !emp.marcadores_brasil_habilitado,
                })
              }}
              className="text-xs px-2.5 py-1 rounded-lg font-semibold"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text)',
              }}
            >
              {emp.marcadores_brasil_habilitado ? 'Desligar bônus BR' : 'Ligar bônus BR'}
            </button>
          </div>
        </div>
      ))}
    </div>
    </>
  )
}
