import { api, apiPostMultipart } from '@/lib/api'
import type { ConviteResultado, MembroEquipe } from '@/types'

function empresaQs(empresaId?: number | null): string {
  if (empresaId == null) return ''
  return `?empresa_id=${empresaId}`
}

export const equipeService = {
  async listarEquipe(empresaId?: number | null): Promise<MembroEquipe[]> {
    const tail = empresaId != null ? `?empresa_id=${empresaId}` : ''
    return api.get<MembroEquipe[]>(`/equipe/${tail}`)
  },

  async enviarConvites(emails: string[], empresaId?: number | null): Promise<ConviteResultado[]> {
    return api.post<ConviteResultado[]>(`/equipe/convites${empresaQs(empresaId)}`, { emails })
  },

  async listarConvites(empresaId?: number | null): Promise<ConviteResultado[]> {
    return api.get<ConviteResultado[]>(`/equipe/convites${empresaQs(empresaId)}`)
  },

  async bloquearUsuario(usuarioId: number, bloqueado: boolean, empresaId?: number | null): Promise<void> {
    const params = new URLSearchParams({ bloqueado: String(bloqueado) })
    if (empresaId != null) params.set('empresa_id', String(empresaId))
    await api.patch(`/equipe/${usuarioId}/bloquear?${params.toString()}`)
  },

  async removerUsuario(usuarioId: number, empresaId?: number | null): Promise<void> {
    await api.delete(`/equipe/${usuarioId}${empresaQs(empresaId)}`)
  },

  async resetSenhaMembro(usuarioId: number, empresaId?: number | null): Promise<void> {
    await api.patch(`/equipe/${usuarioId}/reset-password${empresaQs(empresaId)}`)
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
