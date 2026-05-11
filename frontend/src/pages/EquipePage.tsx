import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldOff,
  Shield,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Send,
  User,
} from 'lucide-react'
import { equipeService } from '@/services/equipe.service'
import type { MembroEquipe, ConviteResultado } from '@/types'
import { ApiError } from '@/lib/api'
import { imgUrl } from '@/lib/utils'
import { OwnerEmpresaPicker } from '@/components/OwnerEmpresaPicker'
import { useResolvedEmpresaForAdmin } from '@/hooks/useResolvedEmpresaForAdmin'
import { useAuth } from '@/features/auth/AuthContext'
import { empresaService } from '@/services/empresa.service'

function StatusBadge({ membro }: { membro: MembroEquipe }) {
  if (membro.tipo === 'convite') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(251,191,36,0.15)', color: '#f59e0b' }}
      >
        <Clock size={10} />
        Convite pendente
      </span>
    )
  }
  if (membro.bloqueado) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
      >
        <XCircle size={10} />
        Bloqueado
      </span>
    )
  }
  if (membro.primeiro_login) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
      >
        <Clock size={10} />
        Aguardando ativação
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
    >
      <CheckCircle2 size={10} />
      Ativo
    </span>
  )
}

interface MemberCardProps {
  membro: MembroEquipe
  onBloquear?: (id: number, bloqueado: boolean) => void
  onRemover?: (id: number) => void
  onResetSenha?: (id: number, nome: string) => void
}

function MemberCard({
  membro,
  onBloquear,
  onRemover,
  onResetSenha,
}: MemberCardProps) {
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyToken = () => {
    if (membro.token) {
      const link = `${window.location.origin}/ativar-conta?token=${membro.token}`
      void navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
      >
        {membro.avatar_url ? (
          <img src={imgUrl(membro.avatar_url)} alt={membro.nome ?? membro.email} className="w-full h-full object-cover" />
        ) : (
          <User size={18} style={{ color: 'var(--text-muted)' }} aria-hidden />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
              {membro.nome ?? membro.email}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {membro.nome ? membro.email : ''}
            </p>
            {membro.funcao && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {membro.funcao}
              </p>
            )}
          </div>
          <StatusBadge membro={membro} />
        </div>

        {/* Convite: expira em */}
        {membro.tipo === 'convite' && membro.expiracao && (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Expira em{' '}
              {new Date(membro.expiracao).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <button
              onClick={() => setShowToken((v) => !v)}
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--accent)' }}
            >
              {showToken ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showToken ? 'Ocultar link' : 'Ver link de ativação'}
            </button>
            <AnimatePresence>
              {showToken && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'var(--border)', fontSize: '10px', color: 'var(--text-muted)' }}
                  >
                    <span className="flex-1 truncate font-mono">
                      {`${window.location.origin}/ativar-conta?token=${membro.token}`}
                    </span>
                    <button onClick={copyToken} style={{ color: copied ? 'var(--accent)' : undefined, flexShrink: 0 }}>
                      {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Ações para usuários */}
        {membro.tipo === 'usuario' && membro.id && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onBloquear?.(membro.id!, !membro.bloqueado)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{
                background: membro.bloqueado ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                color: membro.bloqueado ? '#34d399' : '#ef4444',
              }}
            >
              {membro.bloqueado ? <Shield size={11} /> : <ShieldOff size={11} />}
              {membro.bloqueado ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button
              type="button"
              onClick={() => onRemover?.(membro.id!)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
            >
              <Trash2 size={11} />
              Remover
            </button>
            <button
              type="button"
              onClick={() => onResetSenha?.(membro.id!, membro.nome ?? membro.email)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
            >
              Nova senha
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function InviteForm({
  empresaId,
  onSuccess,
}: {
  empresaId: number | undefined
  onSuccess: (results: ConviteResultado[]) => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const emails = text
      .split(/[\n,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'))

    if (emails.length === 0) {
      setError('Informe ao menos um e-mail válido')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const results = await equipeService.enviarConvites(emails, empresaId)
      onSuccess(results)
      setText('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar convites')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          E-mails para convidar
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'joao@empresa.com\nmaria@empresa.com'}
          rows={4}
          className="px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
          style={{
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Um e-mail por linha, ou separados por vírgula/ponto-e-vírgula
        </p>
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          {error}
        </p>
      )}

      <motion.button
        type="submit"
        disabled={loading || !text.trim()}
        whileTap={{ scale: 0.97 }}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        <Send size={14} />
        {loading ? 'Enviando…' : 'Enviar convites'}
      </motion.button>
    </form>
  )
}

function InviteResults({ results, onClose }: { results: ConviteResultado[]; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (token: string) => {
    const link = `${window.location.origin}/ativar-conta?token=${token}`
    void navigator.clipboard.writeText(link)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        Resultado do envio
      </p>
      {results.map((r) => (
        <div
          key={r.email}
          className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
              {r.email}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {r.status === 'convite_criado' &&
                (r.convite_enviado_por_email
                  ? 'Convite enviado por e-mail — peça para checar a caixa de entrada'
                  : r.token
                    ? 'Convite criado — copie o link abaixo'
                    : 'Convite criado')}
              {r.status === 'convite_pendente' && 'Convite pendente (já existe)'}
              {r.status === 'ja_cadastrado' && 'Usuário já cadastrado'}
            </p>
          </div>
          {r.token && (
            <button onClick={() => copy(r.token!)} style={{ color: copied === r.token ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>
              {copied === r.token ? <CheckCircle2 size={15} /> : <Copy size={15} />}
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onClose}
        className="text-sm text-center"
        style={{ color: 'var(--accent)' }}
      >
        Convidar mais pessoas
      </button>
    </div>
  )
}

export function EquipePage() {
  const queryClient = useQueryClient()
  const { empresaId: authEmpresaId } = useAuth()
  const { resolvedEmpresaId, setOwnerEmpresaId, needsOwnerEmpresaPick } = useResolvedEmpresaForAdmin()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteResults, setInviteResults] = useState<ConviteResultado[] | null>(null)

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
    enabled: needsOwnerEmpresaPick,
  })

  useEffect(() => {
    if (!needsOwnerEmpresaPick || resolvedEmpresaId != null || empresas.length === 0) return
    setOwnerEmpresaId(empresas[0].id)
  }, [needsOwnerEmpresaPick, resolvedEmpresaId, empresas, setOwnerEmpresaId])

  const effectiveEmpresaId = needsOwnerEmpresaPick ? resolvedEmpresaId : authEmpresaId

  const { data: equipe, isLoading } = useQuery({
    queryKey: ['equipe', effectiveEmpresaId],
    queryFn: () => equipeService.listarEquipe(effectiveEmpresaId ?? undefined),
    enabled: effectiveEmpresaId != null,
  })

  const bloquearMutation = useMutation({
    mutationFn: ({ id, bloqueado }: { id: number; bloqueado: boolean }) =>
      equipeService.bloquearUsuario(id, bloqueado, effectiveEmpresaId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipe'] }),
  })

  const removerMutation = useMutation({
    mutationFn: (id: number) => equipeService.removerUsuario(id, effectiveEmpresaId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipe'] }),
  })

  const resetSenhaMutation = useMutation({
    mutationFn: ({ id, senha }: { id: number; senha: string }) =>
      equipeService.resetSenhaMembro(id, senha, effectiveEmpresaId ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipe'] }),
  })

  const handleResetSenha = (id: number, nome: string) => {
    const senha = window.prompt(
      `Nova senha para ${nome} (mínimo 8 caracteres):`,
      '',
    )
    if (senha == null) return
    if (senha.length < 8) {
      window.alert('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    resetSenhaMutation.mutate({ id, senha })
  }

  const handleInviteSuccess = (results: ConviteResultado[]) => {
    setInviteResults(results)
    void queryClient.invalidateQueries({ queryKey: ['equipe'] })
  }

  const usuarios = equipe?.filter((m) => m.tipo === 'usuario') ?? []
  const convites = equipe?.filter((m) => m.tipo === 'convite') ?? []

  return (
    <div className="pb-24 pt-2 flex flex-col gap-6">
      {needsOwnerEmpresaPick && (
        <OwnerEmpresaPicker value={resolvedEmpresaId} onChange={setOwnerEmpresaId} />
      )}

      {!needsOwnerEmpresaPick && authEmpresaId == null && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          Sua conta não está vinculada a uma empresa.
        </p>
      )}

      {effectiveEmpresaId != null && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                Equipe
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {usuarios.length} {usuarios.length === 1 ? 'membro' : 'membros'}{' '}
                {convites.length > 0 && `· ${convites.length} convite${convites.length > 1 ? 's' : ''} pendente${convites.length > 1 ? 's' : ''}`}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={() => { setShowInvite((v) => !v); setInviteResults(null) }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <UserPlus size={15} />
              Convidar
            </motion.button>
          </div>

          <AnimatePresence>
            {showInvite && (
              <motion.div
                key="invite-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-2xl p-4"
                  style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Mail size={16} style={{ color: 'var(--accent)' }} />
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      Convidar pessoas
                    </h2>
                  </div>
                  {inviteResults ? (
                    <InviteResults results={inviteResults} onClose={() => setInviteResults(null)} />
                  ) : (
                    <InviteForm empresaId={effectiveEmpresaId} onSuccess={handleInviteSuccess} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl animate-pulse"
                  style={{ background: 'var(--glass)' }}
                />
              ))}
            </div>
          ) : (
            <>
              {usuarios.length === 0 && convites.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Users size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                    Nenhum membro ainda
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Use o botão Convidar para adicionar pessoas
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <AnimatePresence>
                    {[...usuarios, ...convites].map((membro) => (
                      <MemberCard
                        key={membro.tipo === 'usuario' ? `u-${membro.id}` : `c-${membro.convite_id}`}
                        membro={membro}
                        onBloquear={(id, bloqueado) => bloquearMutation.mutate({ id, bloqueado })}
                        onRemover={(id) => {
                          if (confirm('Remover este usuário da empresa?')) {
                            removerMutation.mutate(id)
                          }
                        }}
                        onResetSenha={handleResetSenha}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
