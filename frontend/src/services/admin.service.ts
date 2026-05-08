import { api } from '@/lib/api'
import type { User, Pais, ConfiguracaoBolao, PontuacaoFase, ResultadoEspecial } from '@/types'

export interface UpdateConfigPayload {
  data_bloqueio_palpites_especiais: string | null
  pontos_campeao: number
  pontos_vice_campeao: number
  pontos_terceiro_lugar: number
  pontos_artilheiro_pais: number
  pontos_placar_exato: number
  pontos_resultado_correto: number
  pontos_classificado_mata_mata: number
  pontos_marcador_brasil: number
  pontos_marcador_brasil_com_quantidade: number
}

export interface UpdateFasesPayload {
  itens: Array<{
    fase_key: string
    label: string
    ordem: number
    pontos_placar_exato: number
    pontos_resultado_correto: number
    pontos_classificado_mata_mata: number
  }>
}

export interface ResultadoEspecialPayload {
  campeao_id: number | null
  vice_campeao_id: number | null
  terceiro_lugar_id: number | null
  artilheiro_pais_id: number | null
  finalizado: boolean
}

export interface UpdatePaisPayload {
  nome: string
  sigla: string
  grupo: string
  bandeira_url: string
}

export const adminService = {
  getUsers: () => api.get<User[]>('/usuarios'),
  toggleUserStatus: (id: number, ativo: boolean) =>
    api.patch<void>(`/usuarios/${id}/status`, { ativo }),
  resetUserPassword: (id: number) =>
    api.patch<void>(`/usuarios/${id}/reset-password`, {}),

  getPaises: () => api.get<Pais[]>('/paises'),
  updatePais: (id: number, data: UpdatePaisPayload) =>
    api.put<Pais>(`/paises/${id}`, data),

  getConfig: () => api.get<ConfiguracaoBolao>('/configuracao-bolao'),
  updateConfig: (data: UpdateConfigPayload) =>
    api.put<ConfiguracaoBolao>('/configuracao-bolao', data),

  getFases: () => api.get<PontuacaoFase[]>('/configuracao-pontuacao-fase'),
  updateFases: (data: UpdateFasesPayload) =>
    api.put<void>('/configuracao-pontuacao-fase', data),

  getResultadoEspecial: () =>
    api.get<ResultadoEspecial | null>('/resultados-especiais'),
  saveResultadoEspecial: (data: ResultadoEspecialPayload, exists: boolean) =>
    exists
      ? api.put<ResultadoEspecial>('/resultados-especiais', data)
      : api.post<ResultadoEspecial>('/resultados-especiais', data),
  finalizarResultadoEspecial: () =>
    api.patch<void>('/resultados-especiais/finalizar', {}),
}
