import { api, ApiError, apiPostMultipart } from '@/lib/api'
import type { BulkConviteResponse, ConviteResultado, ConviteResumoEnvio, MembroEquipe } from '@/types'

/** Prefixo /api evita colisão Nginx entre SPA (/equipe) e FastAPI. */
const EQUIPE_API = '/api/equipe'

const INVITE_SUCCESS_STATUSES = new Set<ConviteResultado['status']>([
  'convite_criado',
  'convite_pendente',
  'ja_cadastrado',
])

function empresaQs(empresaId?: number | null): string {
  if (empresaId == null) return ''
  return `?empresa_id=${empresaId}`
}

export const equipeService = {
  async listarEquipe(empresaId?: number | null): Promise<MembroEquipe[]> {
    return api.get<MembroEquipe[]>(`${EQUIPE_API}${empresaQs(empresaId)}`)
  },

  async enviarConvites(emails: string[], empresaId?: number | null): Promise<BulkConviteResponse> {
    return api.post<BulkConviteResponse>(`${EQUIPE_API}/convites${empresaQs(empresaId)}`, { emails })
  },

  async enviarConvitesEmLotes(
    emails: string[],
    empresaId?: number | null,
    onProgress?: (processed: number, total: number, partial: ConviteResultado[]) => void,
  ): Promise<BulkConviteResponse> {
    const response = await this.enviarConvites(emails, empresaId)
    onProgress?.(emails.length, emails.length, response.itens)

    const hasSuccess = response.itens.some((item) => INVITE_SUCCESS_STATUSES.has(item.status))
    if (response.itens.length > 0 && !hasSuccess) {
      const firstError = response.itens.find((item) => item.email_erro)?.email_erro
      throw new ApiError(
        firstError ?? 'Nenhum convite foi processado. Tente novamente.',
        0,
      )
    }

    return response
  },

  async listarConvites(empresaId?: number | null): Promise<ConviteResultado[]> {
    return api.get<ConviteResultado[]>(`${EQUIPE_API}/convites${empresaQs(empresaId)}`)
  },

  async reenviarConvite(conviteId: number, empresaId?: number | null): Promise<void> {
    await api.post(`${EQUIPE_API}/convites/${conviteId}/reenviar${empresaQs(empresaId)}`)
  },

  async bloquearUsuario(usuarioId: number, bloqueado: boolean, empresaId?: number | null): Promise<void> {
    const params = new URLSearchParams({ bloqueado: String(bloqueado) })
    if (empresaId != null) params.set('empresa_id', String(empresaId))
    await api.patch(`${EQUIPE_API}/${usuarioId}/bloquear?${params.toString()}`)
  },

  async removerUsuario(usuarioId: number, empresaId?: number | null): Promise<void> {
    await api.delete(`${EQUIPE_API}/${usuarioId}${empresaQs(empresaId)}`)
  },

  async resetSenhaMembro(usuarioId: number, empresaId?: number | null): Promise<void> {
    await api.patch(`${EQUIPE_API}/${usuarioId}/reset-password${empresaQs(empresaId)}`)
  },

  async ativarConta(token: string, nome: string, senha: string, confirmar_senha: string, avatar_url?: string) {
    return api.post<{ access_token: string; token_type: string }>('/auth/ativar-conta', {
      token,
      nome,
      senha,
      confirmar_senha,
      avatar_url: avatar_url ?? null,
    })
  },

  async uploadAvatarPreAtivacao(conviteToken: string, file: File): Promise<{ avatar_url: string }> {
    const fd = new FormData()
    fd.append('token', conviteToken)
    fd.append('file', file)
    return apiPostMultipart<{ avatar_url: string }>('/auth/avatar-pre-ativacao', fd)
  },
}
