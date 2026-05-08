import { api } from '@/lib/api'
import type { ConviteResultado, MembroEquipe } from '@/types'

export const equipeService = {
  async listarEquipe(): Promise<MembroEquipe[]> {
    return api.get<MembroEquipe[]>('/equipe/')
  },

  async enviarConvites(emails: string[]): Promise<ConviteResultado[]> {
    return api.post<ConviteResultado[]>('/equipe/convites', { emails })
  },

  async listarConvites(): Promise<ConviteResultado[]> {
    return api.get<ConviteResultado[]>('/equipe/convites')
  },

  async bloquearUsuario(usuarioId: number, bloqueado: boolean): Promise<void> {
    await api.patch(`/equipe/${usuarioId}/bloquear?bloqueado=${bloqueado}`)
  },

  async removerUsuario(usuarioId: number): Promise<void> {
    await api.delete(`/equipe/${usuarioId}`)
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
}
