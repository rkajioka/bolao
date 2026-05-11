import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserAvatar } from '@/components/UserAvatar'
import { adminService } from '@/services/admin.service'
import { empresaService } from '@/services/empresa.service'
import type { User } from '@/types'

interface AdminUsersProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

type TipoUsuario = User['tipo_usuario']

const TIPO_OPCOES: { value: TipoUsuario; label: string }[] = [
  { value: 'usuario', label: 'Usuário' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Proprietário' },
]

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--text)',
} as const

export function AdminUsers({ success, error }: AdminUsersProps) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [funcao, setFuncao] = useState('')
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>('admin')
  const [empresaId, setEmpresaId] = useState<number | ''>('')

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => adminService.getUsers(),
  })

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
  })

  const resetForm = () => {
    setEditingId(null)
    setNome('')
    setEmail('')
    setSenha('')
    setFuncao('')
    setTipoUsuario('admin')
    setEmpresaId('')
  }

  const createUser = useMutation({
    mutationFn: () =>
      adminService.createUser({
        nome: nome.trim(),
        email: email.trim(),
        senha_plana: senha,
        funcao: funcao.trim() || null,
        tipo_usuario: tipoUsuario,
        empresa_id: tipoUsuario === 'admin' ? Number(empresaId) : empresaId === '' ? null : Number(empresaId),
        ativo: true,
        primeiro_login: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      success('Usuário criado')
      resetForm()
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao criar usuário')
    },
  })

  const updateUser = useMutation({
    mutationFn: (id: number) =>
      adminService.updateUser(id, {
        nome: nome.trim(),
        email: email.trim(),
        funcao: funcao.trim() || null,
        tipo_usuario: tipoUsuario,
        empresa_id: tipoUsuario === 'admin' ? Number(empresaId) : empresaId === '' ? null : Number(empresaId),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      success('Usuário atualizado')
      resetForm()
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao atualizar usuário')
    },
  })

  const startEdit = (u: User) => {
    setEditingId(u.id)
    setNome(u.nome)
    setEmail(u.email)
    setSenha('')
    setFuncao(u.funcao ?? '')
    setTipoUsuario(u.tipo_usuario)
    setEmpresaId(u.empresa_id ?? '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !email.trim()) {
      error('Informe nome e e-mail.')
      return
    }
    if (tipoUsuario === 'admin' && empresaId === '') {
      error('Selecione a empresa do administrador.')
      return
    }
    if (editingId == null) {
      if (senha.length < 8) {
        error('A senha deve ter pelo menos 8 caracteres.')
        return
      }
      createUser.mutate()
      return
    }
    updateUser.mutate(editingId)
  }

  const toggleStatus = async (id: number, ativo: boolean) => {
    try {
      await adminService.toggleUserStatus(id, !ativo)
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      success(`Usuário ${ativo ? 'desativado' : 'ativado'}`)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    }
  }

  const resetPassword = async (id: number, nomeUsuario: string) => {
    const senha_plana = window.prompt(
      `Nova senha para ${nomeUsuario} (mínimo 8 caracteres):`,
      '',
    )
    if (senha_plana == null) return
    if (senha_plana.length < 8) {
      error('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (!confirm(`Confirmar redefinição de senha para ${nomeUsuario}?`)) return
    try {
      await adminService.resetUserPassword(id, senha_plana)
      success('Senha atualizada')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    }
  }

  if (isLoading) {
    return (
      <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
        Carregando…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold">
          {editingId == null ? 'Novo usuário' : 'Editar usuário'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
              required
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
              required
            />
          </label>
          {editingId == null && (
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Senha</span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={inputStyle}
                minLength={8}
                required
              />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Função</span>
            <input
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Papel</span>
            <select
              value={tipoUsuario}
              onChange={(e) => setTipoUsuario(e.target.value as TipoUsuario)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
            >
              {TIPO_OPCOES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Empresa {tipoUsuario === 'admin' ? '(obrigatória)' : '(opcional)'}
            </span>
            <select
              value={empresaId}
              onChange={(e) => setEmpresaId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
              required={tipoUsuario === 'admin'}
            >
              <option value="">Sem empresa</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FormActions
          editingId={editingId}
          isPending={createUser.isPending || updateUser.isPending}
          onCancel={resetForm}
        />
      </form>

      <div className="space-y-2" role="list" aria-label="Lista de usuários">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="glass rounded-2xl p-4 flex items-center gap-3"
            role="listitem"
          >
            <UserAvatar src={u.avatar_url || u.imagem_perfil} alt="" size="lg" className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{u.nome}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{u.funcao}</p>
              {u.empresa_id != null && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Empresa #{u.empresa_id}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: u.ativo ? 'var(--accent-dim)' : 'var(--danger-dim)',
                    color: u.ativo ? 'var(--accent)' : 'var(--danger)',
                    border: `1px solid ${u.ativo ? 'rgba(53,208,127,0.3)' : 'rgba(255,92,122,0.3)'}`,
                  }}
                >
                  {u.ativo ? 'Ativo' : 'Inativo'}
                </span>
                {u.tipo_usuario === 'owner' && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.35)' }}
                  >
                    Proprietário
                  </span>
                )}
                {u.tipo_usuario === 'admin' && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(255,92,122,0.3)' }}
                  >
                    Admin
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => startEdit(u)}
                className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => toggleStatus(u.id, u.ativo)}
                aria-label={`${u.ativo ? 'Desativar' : 'Ativar'} usuário ${u.nome}`}
                className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
              >
                {u.ativo ? 'Desativar' : 'Ativar'}
              </button>
              <button
                type="button"
                onClick={() => resetPassword(u.id, u.nome)}
                aria-label={`Resetar senha de ${u.nome}`}
                className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
              >
                Reset senha
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormActions({
  editingId,
  isPending,
  onCancel,
}: {
  editingId: number | null
  isPending: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: 'var(--accent-dim)',
          border: '1px solid rgba(53,208,127,0.35)',
          color: 'var(--accent)',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Salvando…' : editingId == null ? 'Criar usuário' : 'Salvar alterações'}
      </button>
      {editingId != null && (
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
        >
          Cancelar
        </button>
      )}
    </div>
  )
}
