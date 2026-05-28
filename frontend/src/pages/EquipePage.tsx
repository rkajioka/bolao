import { useState, useEffect, useMemo } from 'react'
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
  Send,
  Upload,
  User,
  RefreshCw,
  Search,
} from 'lucide-react'
import { equipeService } from '@/services/equipe.service'
import type { BulkConviteResponse, ConviteResultado, ConviteResumoEnvio, MembroEquipe } from '@/types'
import { ApiError } from '@/lib/api'
import { parseInviteEmailsFromFile, parseInviteEmailsFromText } from '@/lib/inviteEmails'
import { imgUrl } from '@/lib/utils'
import { OwnerEmpresaPicker } from '@/components/OwnerEmpresaPicker'
import { useResolvedEmpresaForAdmin } from '@/hooks/useResolvedEmpresaForAdmin'
import { useAuth } from '@/features/auth/AuthContext'
import { empresaService } from '@/services/empresa.service'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { useToast } from '@/components/Toast'

type FiltroConviteEquipe = 'todos' | 'link_expirado'

function matchesBuscaEquipe(membro: MembroEquipe, busca: string): boolean {
  const term = busca.trim().toLowerCase()
  if (!term) return true
  const nome = (membro.nome ?? '').toLowerCase()
  const email = membro.email.toLowerCase()
  return nome.includes(term) || email.includes(term)
}

function StatusBadge({ membro }: { membro: MembroEquipe }) {
  if (membro.tipo === 'convite') {
    if (membro.status === 'convite_expirado') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}
        >
          <XCircle size={10} />
          Link expirado
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: 'var(--highlight-dim)', color: 'var(--highlight)' }}
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
        style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}
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
        style={{ background: 'var(--info-dim)', color: 'var(--info)' }}
      >
        <Clock size={10} />
        Aguardando ativação
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
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
  onReenviarConvite?: (conviteId: number) => void
  bloqueandoId?: number | null
  resetandoSenhaId?: number | null
  reenviandoConviteId?: number | null
}

function MemberCard({
  membro,
  onBloquear,
  onRemover,
  onResetSenha,
  onReenviarConvite,
  bloqueandoId = null,
  resetandoSenhaId = null,
  reenviandoConviteId = null,
}: MemberCardProps) {
  const bloquearBusy = membro.id != null && bloqueandoId === membro.id
  const resetBusy = membro.id != null && resetandoSenhaId === membro.id
  const reenviarBusy = membro.convite_id != null && reenviandoConviteId === membro.convite_id
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

        {/* Convite: expiração + botão de reenvio */}
        {membro.tipo === 'convite' && membro.expiracao && (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {membro.status === 'convite_expirado' ? 'Expirou em ' : 'Expira em '}
              {new Date(membro.expiracao).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {membro.convite_id != null && (
              <button
                type="button"
                disabled={reenviarBusy}
                onClick={() => onReenviarConvite?.(membro.convite_id!)}
                aria-label={
                  membro.status === 'convite_expirado'
                    ? `Enviar novo link para ${membro.email}`
                    : `Reenviar convite para ${membro.email}`
                }
                className="self-start flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                style={
                  membro.status === 'convite_expirado'
                    ? { background: 'var(--danger-dim)', color: 'var(--danger)' }
                    : { background: 'var(--highlight-dim)', color: 'var(--highlight)' }
                }
              >
                <RefreshCw size={11} className={reenviarBusy ? 'animate-spin' : ''} />
                {reenviarBusy
                  ? 'Enviando…'
                  : membro.status === 'convite_expirado'
                    ? 'Enviar novo link'
                    : 'Reenviar e-mail'}
              </button>
            )}
          </div>
        )}

        {/* Ações para usuários */}
        {membro.tipo === 'usuario' && membro.id && (
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              disabled={bloquearBusy || resetBusy}
              onClick={() => onBloquear?.(membro.id!, !membro.bloqueado)}
              aria-label={membro.bloqueado ? `Desbloquear ${membro.nome ?? membro.email}` : `Bloquear ${membro.nome ?? membro.email}`}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
              style={{
                background: membro.bloqueado ? 'var(--accent-dim)' : 'var(--danger-dim)',
                color: membro.bloqueado ? 'var(--accent)' : 'var(--danger)',
              }}
            >
              {membro.bloqueado ? <Shield size={11} /> : <ShieldOff size={11} />}
              {membro.bloqueado ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button
              type="button"
              onClick={() => onRemover?.(membro.id!)}
              aria-label={`Remover ${membro.nome ?? membro.email}`}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}
            >
              <Trash2 size={11} />
              Remover
            </button>
            <button
              type="button"
              disabled={bloquearBusy || resetBusy}
              onClick={() => onResetSenha?.(membro.id!, membro.nome ?? membro.email)}
              aria-label={`Redefinir senha de ${membro.nome ?? membro.email}`}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg disabled:opacity-50"
              style={{ background: 'var(--info-dim)', color: 'var(--info)' }}
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
  onBusyChange,
}: {
  empresaId: number | undefined
  onSuccess: (payload: BulkConviteResponse) => void
  onBusyChange?: (busy: boolean) => void
}) {
  const { success, error: toastError } = useToast()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null)
  const [liveResults, setLiveResults] = useState<ConviteResultado[]>([])
  const [importingFile, setImportingFile] = useState(false)

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImportingFile(true)
    setError(null)
    try {
      const imported = await parseInviteEmailsFromFile(file)
      if (imported.length === 0) {
        setError('Nenhum e-mail válido encontrado na coluna A do arquivo.')
        return
      }
      const merged = parseInviteEmailsFromText([text, ...imported].filter(Boolean).join('\n'))
      setText(merged.join('\n'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.')
    } finally {
      setImportingFile(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const emails = parseInviteEmailsFromText(text)

    if (emails.length === 0) {
      setError('Informe ao menos um e-mail válido')
      return
    }
    setLoading(true)
    onBusyChange?.(true)
    setError(null)
    setLiveResults([])
    setProgress({ processed: 0, total: emails.length })
    try {
      const lockedEmpresaId = empresaId
      const payload = await equipeService.enviarConvitesEmLotes(emails, lockedEmpresaId, (processed, total, partial) => {
        setProgress({ processed, total })
        setLiveResults((current) => [...current, ...partial])
      })
      onSuccess(payload)
      setText('')
      const resumo = payload.resumo_envio
      if (resumo.bloqueados_limite > 0) {
        const alertaOwner = resumo.alerta_owners_limite_enviado
          ? ' Os proprietários da plataforma foram alertados por e-mail.'
          : ''
        toastError(
          `${resumo.bloqueados_limite} convite(s) bloqueados por limite de participantes.${alertaOwner}`,
        )
      } else if (resumo.falhas > 0) {
        const alerta = resumo.alerta_admins_enviado
          ? ' Os administradores foram alertados por e-mail.'
          : ''
        toastError(
          `${resumo.falhas} convite(s) não foram entregues por e-mail.${alerta}`,
        )
      } else if (resumo.enviados > 0) {
        success(`${resumo.enviados} convite(s) enviados por e-mail.`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar convites')
    } finally {
      setLoading(false)
      setProgress(null)
      onBusyChange?.(false)
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
          Um e-mail por linha, separados por vírgula/ponto-e-vírgula, ou importe CSV/TXT com os e-mails na primeira coluna
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <label
            className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl cursor-pointer transition-opacity"
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              opacity: importingFile || loading ? 0.6 : 1,
            }}
          >
            <Upload size={14} />
            {importingFile ? 'Lendo arquivo…' : 'Importar CSV/TXT'}
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={handleFileImport}
              disabled={importingFile || loading}
              className="sr-only"
            />
          </label>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Coluna A, até 2 MB
          </span>
        </div>
      </div>

      {progress && (
        <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Enviando convites</span>
            <span>
              {progress.processed}/{progress.total}
            </span>
          </motion.div>
          <motion.div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--accent)', width: `${(progress.processed / progress.total) * 100}%` }}
            />
          </motion.div>
        </motion.div>
      )}

      {liveResults.length > 0 && (
        <motion.div className="space-y-2 max-h-48 overflow-y-auto">
          {liveResults.map((result) => (
            <motion.div
              key={result.email}
              className="px-3 py-2 rounded-xl text-xs"
              style={{ background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <p className="font-medium truncate" style={{ color: 'var(--text)' }}>
                {result.email}
              </p>
              <p className="mt-0.5">
                {result.status === 'falha_requisicao'
                  ? `Falha na requisição: ${result.email_erro ?? 'Falha ao enviar lote'}`
                  : result.convite_enviado_por_email
                  ? 'E-mail enviado'
                  : result.email_erro
                    ? `Falha: ${result.email_erro}. Reenvie o convite.`
                    : result.status === 'ja_cadastrado'
                      ? 'Já cadastrado'
                      : result.status === 'convite_pendente'
                        ? 'Convite pendente'
                        : result.status === 'limite_usuarios'
                          ? 'Limite de participantes atingido'
                          : 'Convite criado — reenvie por e-mail se necessário'}
              </p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <motion.button
        type="submit"
        disabled={loading || importingFile || !text.trim()}
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

function InviteResults({
  results,
  resumo,
  onClose,
}: {
  results: ConviteResultado[]
  resumo: ConviteResumoEnvio | null
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        Resultado do envio
      </p>
      {resumo && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {resumo.enviados} enviados · {resumo.falhas} falha(s)
          {resumo.alerta_admins_enviado ? ' · admins alertados por e-mail' : ''}
        </p>
      )}
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
              {r.status === 'falha_requisicao' &&
                `Falha na requisição: ${r.email_erro ?? 'Falha ao enviar lote'}`}
              {r.status === 'convite_criado' &&
                (r.convite_enviado_por_email
                  ? 'Convite enviado por e-mail — peça para checar a caixa de entrada'
                  : 'Convite criado — reenvie por e-mail se necessário')}
              {r.status === 'convite_pendente' && 'Convite pendente (já existe)'}
              {r.status === 'ja_cadastrado' && 'Usuário já cadastrado'}
              {r.email_erro && r.status !== 'falha_requisicao' ? ` · ${r.email_erro}` : ''}
            </p>
          </div>
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
  const { success, error } = useToast()
  const { empresaId: authEmpresaId } = useAuth()
  const { resolvedEmpresaId, setOwnerEmpresaId, needsOwnerEmpresaPick } = useResolvedEmpresaForAdmin()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResults, setInviteResults] = useState<ConviteResultado[] | null>(null)
  const [inviteResumo, setInviteResumo] = useState<ConviteResumoEnvio | null>(null)
  const [usuarioRemoverId, setUsuarioRemoverId] = useState<number | null>(null)
  const [reenviandoConviteId, setReenviandoConviteId] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroConvite, setFiltroConvite] = useState<FiltroConviteEquipe>('todos')

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

  const { data: equipe, isLoading, isError, error: queryError, refetch } = useQuery({
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
    onSuccess: () => {
      setUsuarioRemoverId(null)
      void queryClient.invalidateQueries({ queryKey: ['equipe'] })
    },
  })

  const resetSenhaMutation = useMutation({
    mutationFn: (id: number) =>
      equipeService.resetSenhaMembro(id, effectiveEmpresaId ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['equipe'] })
      success('Senha redefinida para a padrão. Enviamos as instruções por e-mail.')
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao redefinir senha')
    },
  })

  const handleResetSenha = (id: number) => {
    resetSenhaMutation.mutate(id)
  }

  const handleReenviarConvite = async (conviteId: number) => {
    const eraExpirado = equipe?.some(
      (m) => m.convite_id === conviteId && m.status === 'convite_expirado',
    )
    setReenviandoConviteId(conviteId)
    try {
      await equipeService.reenviarConvite(conviteId, effectiveEmpresaId ?? undefined)
      await queryClient.invalidateQueries({ queryKey: ['equipe'] })
      success(
        eraExpirado
          ? 'Novo link de ativação enviado por e-mail.'
          : 'E-mail de convite reenviado.',
      )
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao reenviar convite')
    } finally {
      setReenviandoConviteId(null)
    }
  }

  const handleInviteSuccess = (payload: BulkConviteResponse) => {
    setInviteResults(payload.itens)
    setInviteResumo(payload.resumo_envio)
    void queryClient.invalidateQueries({ queryKey: ['equipe'] })
  }

  const usuarios = equipe?.filter((m) => m.tipo === 'usuario') ?? []
  const convites = equipe?.filter((m) => m.tipo === 'convite') ?? []
  const totalNaLista = usuarios.length + convites.length
  const convitesExpirados = convites.filter((m) => m.status === 'convite_expirado').length

  const todosMembros = useMemo(() => [...usuarios, ...convites], [usuarios, convites])

  const membrosFiltrados = useMemo(() => {
    return todosMembros.filter((membro) => {
      if (filtroConvite === 'link_expirado') {
        if (membro.tipo !== 'convite' || membro.status !== 'convite_expirado') {
          return false
        }
      }
      return matchesBuscaEquipe(membro, busca)
    })
  }, [todosMembros, busca, filtroConvite])

  const filtroAtivo = busca.trim() !== '' || filtroConvite !== 'todos'

  return (
    <div className="pb-24 pt-2 flex flex-col gap-6">
      <ConfirmDialog
        open={usuarioRemoverId !== null}
        title="Remover participante?"
        description="O usuário deixa de participar do bolão. Para voltar, será necessário um novo convite."
        confirmLabel="Remover"
        tone="danger"
        confirming={removerMutation.isPending}
        onCancel={() => {
          if (!removerMutation.isPending) setUsuarioRemoverId(null)
        }}
        onConfirm={() => {
          if (usuarioRemoverId == null) return
          removerMutation.mutate(usuarioRemoverId)
        }}
      />
      {needsOwnerEmpresaPick && (
        <div className={inviteBusy ? 'pointer-events-none opacity-60' : undefined}>
          <OwnerEmpresaPicker value={resolvedEmpresaId} onChange={setOwnerEmpresaId} />
        </div>
      )}

      {!needsOwnerEmpresaPick && authEmpresaId == null && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          Sua conta ainda não participa do bolão.
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
                {totalNaLista} {totalNaLista === 1 ? 'pessoa' : 'pessoas'} na lista
                {convites.length > 0 &&
                  ` (${convites.length} convite${convites.length > 1 ? 's' : ''} pendente${convites.length > 1 ? 's' : ''})`}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={() => {
                setShowInvite((value) => !value)
                setInviteResults(null)
                setInviteResumo(null)
              }}
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
                    <InviteResults
                      results={inviteResults}
                      resumo={inviteResumo}
                      onClose={() => {
                        setInviteResults(null)
                        setInviteResumo(null)
                      }}
                    />
                  ) : (
                    <InviteForm
                      empresaId={effectiveEmpresaId}
                      onSuccess={handleInviteSuccess}
                      onBusyChange={setInviteBusy}
                    />
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
          ) : isError ? (
            <EmptyState
              icon={<Users size={28} style={{ color: 'var(--text-muted)' }} />}
              title="Não foi possível carregar a equipe"
              description={
                queryError instanceof ApiError
                  ? queryError.message
                  : 'Verifique sua conexão e tente novamente.'
              }
              action={
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="text-sm font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  Tentar novamente
                </button>
              }
            />
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
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: 'var(--text-muted)' }}
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome ou e-mail…"
                        aria-label="Buscar na equipe"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{
                          background: 'var(--glass)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'todos' as const, label: 'Todos' },
                          {
                            id: 'link_expirado' as const,
                            label: `Link expirado${convitesExpirados > 0 ? ` (${convitesExpirados})` : ''}`,
                          },
                        ] as const
                      ).map((opcao) => {
                        const ativo = filtroConvite === opcao.id
                        return (
                          <button
                            key={opcao.id}
                            type="button"
                            onClick={() => setFiltroConvite(opcao.id)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                            style={
                              ativo
                                ? { background: 'var(--accent)', color: '#fff' }
                                : {
                                    background: 'var(--glass)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-muted)',
                                  }
                            }
                          >
                            {opcao.label}
                          </button>
                        )
                      })}
                    </div>
                    {filtroAtivo && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Exibindo {membrosFiltrados.length} de {totalNaLista}
                      </p>
                    )}
                  </div>

                  {membrosFiltrados.length === 0 ? (
                    <EmptyState
                      icon={<Users size={28} style={{ color: 'var(--text-muted)' }} />}
                      title="Nenhum resultado"
                      description={
                        filtroConvite === 'link_expirado'
                          ? 'Não há convites com link de ativação expirado.'
                          : 'Nenhum membro corresponde à busca.'
                      }
                    />
                  ) : (
                    <AnimatePresence>
                      {membrosFiltrados.map((membro) => (
                        <MemberCard
                          key={membro.tipo === 'usuario' ? `u-${membro.id}` : `c-${membro.convite_id}`}
                          membro={membro}
                          onBloquear={(id, bloqueado) => bloquearMutation.mutate({ id, bloqueado })}
                          onRemover={(id) => setUsuarioRemoverId(id)}
                          onResetSenha={handleResetSenha}
                          onReenviarConvite={handleReenviarConvite}
                          bloqueandoId={
                            bloquearMutation.isPending ? bloquearMutation.variables?.id ?? null : null
                          }
                          resetandoSenhaId={
                            resetSenhaMutation.isPending ? resetSenhaMutation.variables ?? null : null
                          }
                          reenviandoConviteId={reenviandoConviteId}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
