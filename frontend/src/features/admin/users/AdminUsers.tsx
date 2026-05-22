import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, KeyRound, Pencil, UserCheck, UserX } from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import { fieldControlStyle } from '@/lib/fieldStyles'
import { adminService } from '@/services/admin.service'
import { empresaService } from '@/services/empresa.service'
import type { User, UsuarioEmailEntrega } from '@/types'

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

const TIPO_LABEL: Record<TipoUsuario, string> = {
  usuario: 'Usuário',
  admin: 'Admin',
  owner: 'Proprietário',
}

function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function usuarioAtendeBusca(
  usuario: User,
  query: string,
  empresaNome: string,
): boolean {
  const tokens = normalizarBusca(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const corpus = normalizarBusca(
    [
      usuario.nome,
      usuario.email,
      usuario.funcao ?? '',
      TIPO_LABEL[usuario.tipo_usuario],
      empresaNome,
      usuario.ativo ? 'ativo' : 'inativo',
      String(usuario.empresa_id ?? ''),
      String(usuario.id),
    ].join(' '),
  )

  return tokens.every((token) => corpus.includes(token))
}

const inputStyle = fieldControlStyle

function mensagemEntregaEmail(entrega: UsuarioEmailEntrega | undefined, sucessoPadrao: string): string {
  if (entrega?.email_enviado) {
    return sucessoPadrao
  }
  if (entrega?.email_enviado === false) {
    const alerta = entrega.alerta_admins_enviado ? ' Os administradores foram alertados por e-mail.' : ''
    return `Operação concluída, mas o e-mail não foi entregue.${alerta}`
  }
  return sucessoPadrao
}

export function AdminUsers({ success, error }: AdminUsersProps) {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [funcao, setFuncao] = useState('')
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>('admin')
  const [empresaId, setEmpresaId] = useState<number | ''>('')
  const [listaUsuariosAberta, setListaUsuariosAberta] = useState(false)
  const [buscaUsuarios, setBuscaUsuarios] = useState('')
  const [formVersion, setFormVersion] = useState(0)

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => adminService.getUsers(),
  })

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
  })

  const empresasPorId = useMemo(
    () => new Map(empresas.map((empresa) => [empresa.id, empresa.nome])),
    [empresas],
  )

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((usuario) =>
      usuarioAtendeBusca(
        usuario,
        buscaUsuarios,
        usuario.empresa_id != null ? empresasPorId.get(usuario.empresa_id) ?? '' : '',
      ),
    )
  }, [usuarios, buscaUsuarios, empresasPorId])

  const resetForm = () => {
    setEditingId(null)
    setNome('')
    setEmail('')
    setFuncao('')
    setTipoUsuario('admin')
    setEmpresaId('')
    setFormVersion((version) => version + 1)
  }

  const createUser = useMutation({
    mutationFn: () =>
      adminService.createUser({
        nome: nome.trim(),
        email: email.trim(),
        funcao: funcao.trim() || null,
        tipo_usuario: tipoUsuario,
        empresa_id: tipoUsuario === 'admin' ? Number(empresaId) : empresaId === '' ? null : Number(empresaId),
        ativo: true,
        primeiro_login: true,
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      const message = mensagemEntregaEmail(
        created,
        'Usuário criado. Enviamos um link único por e-mail para definir a senha.',
      )
      if (created.email_enviado === false) {
        error(message)
      } else {
        success(message)
      }
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
    setListaUsuariosAberta(true)
    setEditingId(u.id)
    setNome(u.nome)
    setEmail(u.email)
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
    try {
      const entrega = await adminService.resetUserPassword(id)
      const message = mensagemEntregaEmail(
        entrega,
        `Senha de ${nomeUsuario} redefinida para a padrão. Enviamos as instruções por e-mail.`,
      )
      if (entrega.email_enviado === false) {
        error(message)
      } else {
        success(message)
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao redefinir senha')
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
      <form
        key={formVersion}
        onSubmit={handleSubmit}
        autoComplete="off"
        className="glass rounded-2xl p-4 space-y-3"
      >
        <p className="text-sm font-semibold">
          {editingId == null ? 'Novo usuário' : 'Editar usuário'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="off"
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
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={inputStyle}
              required
            />
          </label>
          {editingId == null && (
            <p className="text-xs sm:col-span-2" style={{ color: 'var(--text-muted)' }}>
              O acesso será enviado por e-mail com um link único para definir a senha.
            </p>
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

      <div className="glass rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setListaUsuariosAberta((aberta) => !aberta)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
          style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: 'var(--text)' }}
          aria-expanded={listaUsuariosAberta}
        >
          <span className="text-sm font-semibold">
            Usuários cadastrados ({usuarios.length})
          </span>
          <ChevronDown
            size={18}
            className="shrink-0 transition-transform duration-200"
            style={{
              transform: listaUsuariosAberta ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--text-muted)',
            }}
          />
        </button>

        <AnimatePresence initial={false}>
          {listaUsuariosAberta && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-4 pt-3 space-y-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Cadastrados ({usuarios.length})
                    {usuariosFiltrados.length !== usuarios.length && (
                      <span> — exibindo {usuariosFiltrados.length}</span>
                    )}
                  </p>
                  <input
                    type="search"
                    value={buscaUsuarios}
                    onChange={(e) => setBuscaUsuarios(e.target.value)}
                    placeholder="Buscar por nome, e-mail, função, papel, empresa ou status…"
                    aria-label="Buscar usuários"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={inputStyle}
                  />
                </div>

                <div
                  className="rounded-xl overflow-y-auto max-h-[min(28rem,60vh)]"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {usuariosFiltrados.length === 0 ? (
                    <p className="text-sm py-6 px-3 text-center" style={{ color: 'var(--text-muted)' }}>
                      {usuarios.length === 0
                        ? 'Nenhum usuário cadastrado ainda.'
                        : 'Nenhum resultado para essa busca.'}
                    </p>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {usuariosFiltrados.map((u) => {
                        const empresaNome =
                          u.empresa_id != null
                            ? empresasPorId.get(u.empresa_id) ?? `Empresa #${u.empresa_id}`
                            : null

                        return (
                          <li
                            key={u.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-3 py-3"
                            style={{
                              background: editingId === u.id ? 'rgba(53,208,127,0.06)' : 'transparent',
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                src={u.avatar_url || u.imagem_perfil}
                                alt=""
                                size="sm"
                                className="shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">{u.nome}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                  {u.email}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 self-start">
                              <UserIconAction
                                label={`Editar ${u.nome}`}
                                onClick={() => startEdit(u)}
                              >
                                <Pencil size={14} strokeWidth={2} />
                              </UserIconAction>
                              <UserIconAction
                                label={u.ativo ? `Desativar ${u.nome}` : `Ativar ${u.nome}`}
                                onClick={() => toggleStatus(u.id, u.ativo)}
                                tone={u.ativo ? 'danger' : 'accent'}
                              >
                                {u.ativo ? (
                                  <UserX size={14} strokeWidth={2} />
                                ) : (
                                  <UserCheck size={14} strokeWidth={2} />
                                )}
                              </UserIconAction>
                              <UserIconAction
                                label={`Resetar senha de ${u.nome}`}
                                onClick={() => resetPassword(u.id, u.nome)}
                              >
                                <KeyRound size={14} strokeWidth={2} />
                              </UserIconAction>
                            </div>

                            <div className="col-span-2 flex flex-wrap items-center gap-1.5 min-w-0">
                              <UserRoleBadge tipo={u.tipo_usuario} />
                              <UserStatusBadge ativo={u.ativo} />
                              {empresaNome && (
                                <span
                                  className="text-xs truncate max-w-full"
                                  style={{ color: 'var(--text-muted)' }}
                                  title={empresaNome}
                                >
                                  {empresaNome}
                                </span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function UserRoleBadge({ tipo }: { tipo: TipoUsuario }) {
  const style =
    tipo === 'owner'
      ? {
          background: 'rgba(168,85,247,0.15)',
          color: '#c084fc',
          border: '1px solid rgba(168,85,247,0.35)',
        }
      : tipo === 'admin'
        ? {
            background: 'var(--danger-dim)',
            color: 'var(--danger)',
            border: '1px solid rgba(255,92,122,0.3)',
          }
        : {
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-muted)',
            border: '1px solid rgba(255,255,255,0.10)',
          }

  return (
    <span
      className="inline-flex text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0"
      style={style}
    >
      {TIPO_LABEL[tipo]}
    </span>
  )
}

function UserStatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className="inline-flex text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0"
      style={{
        background: ativo ? 'var(--accent-dim)' : 'var(--danger-dim)',
        color: ativo ? 'var(--accent)' : 'var(--danger)',
        border: `1px solid ${ativo ? 'rgba(53,208,127,0.3)' : 'rgba(255,92,122,0.3)'}`,
      }}
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

function UserIconAction({
  label,
  onClick,
  children,
  tone = 'neutral',
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  tone?: 'neutral' | 'accent' | 'danger'
}) {
  const colors =
    tone === 'accent'
      ? { color: 'var(--accent)', border: 'rgba(53,208,127,0.25)', bg: 'rgba(53,208,127,0.08)' }
      : tone === 'danger'
        ? { color: 'var(--danger)', border: 'rgba(255,92,122,0.25)', bg: 'rgba(255,92,122,0.08)' }
        : { color: 'var(--text-muted)', border: 'rgba(255,255,255,0.10)', bg: 'rgba(255,255,255,0.04)' }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{
        color: colors.color,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        outlineColor: 'var(--accent)',
      }}
    >
      {children}
    </button>
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
