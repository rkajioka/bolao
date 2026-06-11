import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Send } from 'lucide-react'
import { equipeService } from '@/services/equipe.service'
import { ApiError } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'

const MAX_ASSUNTO = 200
const MAX_MENSAGEM = 4000

export function ComunicadoEquipePanel({
  empresaId,
  adminEmail,
  onBusyChange,
}: {
  empresaId: number | undefined
  adminEmail: string | undefined
  onBusyChange?: (busy: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { success, error: toastError } = useToast()
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modoTeste, setModoTeste] = useState(true)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['equipe', 'comunicado-preview', empresaId, modoTeste],
    queryFn: () => equipeService.previewComunicado(empresaId ?? undefined, modoTeste),
    enabled: empresaId != null,
  })

  const assuntoValido = assunto.trim().length > 0 && assunto.trim().length <= MAX_ASSUNTO
  const mensagemValida = mensagem.trim().length > 0 && mensagem.trim().length <= MAX_MENSAGEM
  const podeEnviar =
    assuntoValido &&
    mensagemValida &&
    (preview?.total_destinatarios ?? 0) > 0 &&
    !loading &&
    !previewLoading

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!podeEnviar) return
    setFormError(null)
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    if (!podeEnviar) return
    setLoading(true)
    onBusyChange?.(true)
    setFormError(null)
    try {
      const lockedEmpresaId = empresaId
      const lockedModoTeste = modoTeste
      const response = await equipeService.enviarComunicado(
        { assunto: assunto.trim(), mensagem: mensagem.trim(), modo_teste: lockedModoTeste },
        lockedEmpresaId,
      )
      setAssunto('')
      setMensagem('')
      setConfirmOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['equipe', 'comunicado-preview'] })
      if (response.modo_teste) {
        success('E-mail enfileirado. Verifique sua caixa de entrada.')
      } else {
        success(
          `Comunicado enfileirado para ${response.total_destinatarios} participantes. Envio em segundo plano.`,
        )
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          toastError('Nenhum participante ativo encontrado.')
        } else if (err.status === 429) {
          toastError('Limite de envios atingido. Tente novamente mais tarde.')
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError('Erro ao enfileirar comunicado.')
      }
      setConfirmOpen(false)
    } finally {
      setLoading(false)
      onBusyChange?.(false)
    }
  }

  const totalDestinatarios = preview?.total_destinatarios ?? 0
  const confirmDescription = modoTeste
    ? 'Enviar e-mail de teste apenas para você?'
    : `Enviar para ${totalDestinatarios} participantes ativos (inclui admins)?`

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar envio"
        description={confirmDescription}
        confirmLabel="Enviar"
        tone="warning"
        confirming={loading}
        onCancel={() => {
          if (!loading) setConfirmOpen(false)
        }}
        onConfirm={() => void handleConfirm()}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label
          className="flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer"
          style={{
            background: modoTeste ? 'rgba(212,160,23,0.12)' : 'var(--glass)',
            border: modoTeste
              ? '1px solid rgba(212,160,23,0.35)'
              : '1px solid var(--border)',
          }}
        >
          <input
            type="checkbox"
            checked={modoTeste}
            onChange={(e) => setModoTeste(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--highlight)]"
          />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              Modo teste — enviar apenas para mim
            </span>
            <span className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {modoTeste ? (
                <>
                  O e-mail vai só para{' '}
                  <strong style={{ color: 'var(--highlight)' }}>
                    {adminEmail ?? 'seu endereço'}
                  </strong>
                  . Desmarque para enviar a todos os participantes ativos.
                </>
              ) : (
                <>
                  O e-mail será enviado a{' '}
                  <strong style={{ color: 'var(--accent)' }}>
                    {previewLoading ? '…' : totalDestinatarios}
                  </strong>{' '}
                  participantes ativos (inclui admins). Marque para testar só com você.
                </>
              )}
            </span>
          </span>
        </label>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Assunto *
          </label>
          <input
            type="text"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value.slice(0, MAX_ASSUNTO))}
            placeholder="Ex.: Lembrete — palpites da 1ª rodada"
            maxLength={MAX_ASSUNTO}
            className="px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
            {assunto.length}/{MAX_ASSUNTO}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Mensagem *
          </label>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value.slice(0, MAX_MENSAGEM))}
            placeholder="Escreva o aviso para a equipe…"
            rows={6}
            maxLength={MAX_MENSAGEM}
            className="px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          <p className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
            {mensagem.length}/{MAX_MENSAGEM}
          </p>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {previewLoading
            ? 'Calculando destinatários…'
            : modoTeste
              ? 'Destinatários: 1 (modo teste)'
              : `Destinatários: ${totalDestinatarios} participantes ativos`}
        </p>

        {formError && (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={!podeEnviar}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Send size={15} />
          {loading ? 'Enviando…' : 'Enviar e-mail'}
        </button>
      </form>
    </>
  )
}

export function ComunicadoEquipePanelHeader() {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Mail size={16} style={{ color: 'var(--accent)' }} />
      <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
        Enviar e-mail à equipe
      </h2>
    </div>
  )
}
