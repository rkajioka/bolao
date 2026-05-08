import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserAvatar } from '@/components/UserAvatar'
import { adminService } from '@/services/admin.service'

interface AdminUsersProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

export function AdminUsers({ success, error }: AdminUsersProps) {
  const queryClient = useQueryClient()

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => adminService.getUsers(),
  })

  const toggleStatus = async (id: number, ativo: boolean) => {
    try {
      await adminService.toggleUserStatus(id, !ativo)
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      success(`Usuário ${ativo ? 'desativado' : 'ativado'}`)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    }
  }

  const resetPassword = async (id: number, nome: string) => {
    if (!confirm(`Resetar senha de ${nome}?`)) return
    try {
      await adminService.resetUserPassword(id)
      success('Senha resetada para o padrão')
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
            <div className="flex items-center gap-2 mt-1.5">
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
              onClick={() => toggleStatus(u.id, u.ativo)}
              aria-label={`${u.ativo ? 'Desativar' : 'Ativar'} usuário ${u.nome}`}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            >
              {u.ativo ? 'Desativar' : 'Ativar'}
            </button>
            <button
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
  )
}
