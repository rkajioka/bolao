import { api, apiPostMultipart } from '@/lib/api'
import type { User } from '@/types'

/** Mesmo limite do backend (2 MiB). */
export const PERFIL_AVATAR_MAX_BYTES = 2 * 1024 * 1024

export const perfilService = {
  async getPerfil(): Promise<User> {
    return api.get<User>('/perfil/')
  },

  async updatePerfil(data: { nome?: string; funcao?: string; avatar_url?: string }): Promise<User> {
    return api.patch<User>('/perfil/', data)
  },

  async uploadAvatar(file: File): Promise<User> {
    const fd = new FormData()
    fd.append('file', file)
    return apiPostMultipart<User>('/perfil/avatar', fd)
  },

  async removeAvatar(): Promise<User> {
    return api.delete<User>('/perfil/avatar')
  },

  async alterarSenha(senha_atual: string, nova_senha: string, confirmar_senha: string): Promise<void> {
    await api.post('/perfil/alterar-senha', { senha_atual, nova_senha, confirmar_senha })
  },

  async forgotPassword(email: string): Promise<{ mensagem: string }> {
    return api.post<{ mensagem: string }>('/auth/forgot-password', { email })
  },

  async redefinirSenha(
    token: string,
    nova_senha: string,
    confirmar_senha: string,
  ): Promise<{ access_token: string }> {
    return api.post<{ access_token: string }>('/auth/redefinir-senha', {
      token,
      nova_senha,
      confirmar_senha,
    })
  },
}
