import { api, apiPostMultipart } from '@/lib/api'
import type { BulkConviteResponse, ConviteResultado, ConviteResumoEnvio, MembroEquipe } from '@/types'

const INVITE_CHUNK_SIZE = 5
const INVITE_CHUNK_PAUSE_MS = 1200

function empresaQs(empresaId?: number | null): string {
  if (empresaId == null) return ''
  return `?empresa_id=${empresaId}`
}

function chunkEmails(emails: string[], size: number): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < emails.length; index += size) {
    chunks.push(emails.slice(index, index + size))
  }
  return chunks
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function mergeResumo(current: ConviteResumoEnvio | null, next: ConviteResumoEnvio): ConviteResumoEnvio {
  if (current == null) {
    return next
  }
  return {
    total: current.total + next.total,
    enviados: current.enviados + next.enviados,
    falhas: current.falhas + next.falhas,
    alerta_admins_enviado: current.alerta_admins_enviado || next.alerta_admins_enviado,
  }
}

export const equipeService = {
  async listarEquipe(empresaId?: number | null): Promise<MembroEquipe[]> {
    const tail = empresaId != null ? `?empresa_id=${empresaId}` : ''
    return api.get<MembroEquipe[]>(`/equipe/${tail}`)
  },

  async enviarConvites(emails: string[], empresaId?: number | null): Promise<BulkConviteResponse> {
    return api.post<BulkConviteResponse>(`/equipe/convites${empresaQs(empresaId)}`, { emails })
  },

  async enviarConvitesEmLotes(
    emails: string[],
    empresaId?: number | null,
    onProgress?: (processed: number, total: number, partial: ConviteResultado[]) => void,
  ): Promise<BulkConviteResponse> {
    const chunks = chunkEmails(emails, INVITE_CHUNK_SIZE)
    let itens: ConviteResultado[] = []
    let resumo: ConviteResumoEnvio | null = null

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index]
      try {
        const response = await this.enviarConvites(chunk, empresaId)
        itens = [...itens, ...response.itens]
        resumo = mergeResumo(resumo, response.resumo_envio)
        onProgress?.(itens.length, emails.length, response.itens)
      } catch (error) {
        const failedItems: ConviteResultado[] = chunk.map((email) => ({
          email,
          status: 'convite_criado',
          convite_enviado_por_email: false,
          email_erro: error instanceof Error ? error.message : 'Falha ao enviar lote',
        }))
        itens = [...itens, ...failedItems]
        resumo = mergeResumo(
          resumo,
          {
            total: failedItems.length,
            enviados: 0,
            falhas: failedItems.length,
            alerta_admins_enviado: false,
          },
        )
        onProgress?.(itens.length, emails.length, failedItems)
      }

      if (index < chunks.length - 1) {
        await sleep(INVITE_CHUNK_PAUSE_MS)
      }
    }

    return {
      itens,
      resumo_envio: resumo ?? {
        total: 0,
        enviados: 0,
        falhas: 0,
        alerta_admins_enviado: false,
      },
    }
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
