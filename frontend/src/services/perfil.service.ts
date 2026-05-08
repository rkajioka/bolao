import { api } from '@/lib/api'
import type { User } from '@/types'

export const perfilService = {
  async getPerfil(): Promise<User> {
    return api.get<User>('/perfil/')
  },

  async updatePerfil(data: { nome?: string; funcao?: string; avatar_url?: string }): Promise<User> {
    return api.patch<User>('/perfil/', data)
  },

  async alterarSenha(senha_atual: string, nova_senha: string, confirmar_senha: string): Promise<void> {
    await api.post('/perfil/alterar-senha', { senha_atual, nova_senha, confirmar_senha })
  },

  async forgotPassword(email: string): Promise<{ mensagem: string }> {
    return api.post<{ mensagem: string }>('/auth/forgot-password', { email })
  },

  async redefinirSenha(token: string, nova_senha: string, confirmar_senha: string): Promise<void> {
    await api.post('/auth/redefinir-senha', { token, nova_senha, confirmar_senha })
  },
}
