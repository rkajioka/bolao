import { api } from '@/lib/api'
import type { Jogo } from '@/types'

export interface CreateJogoPayload {
  tipo_fase: 'grupos' | 'mata_mata'
  grupo: string | null
  rodada: number | null
  fase: string
  pais_casa_id: number
  pais_fora_id: number
  data_jogo: string
}

export interface UpdateResultadoPayload {
  placar_casa: number
  placar_fora: number
}

export interface MarcadorAdminItem {
  nome_jogador: string
  quantidade_gols: number
}

export const gamesService = {
  getAll: (signal?: AbortSignal) => api.get<Jogo[]>('/jogos/cronologico', signal),

  create: (data: CreateJogoPayload) => api.post<Jogo>('/jogos', data),

  updateResult: (id: number, data: UpdateResultadoPayload) =>
    api.patch<void>(`/jogos/${id}/resultado`, data),

  finalize: (id: number) => api.patch<void>(`/jogos/${id}/finalizar`, {}),

  getMarcadoresAdmin: (jogoId: number) =>
    api.get<MarcadorAdminItem[]>(`/marcadores-brasil/admin/${jogoId}`),

  saveMarcadoresAdmin: (jogoId: number, marcadores: MarcadorAdminItem[]) =>
    api.put<void>(`/marcadores-brasil/resultado/${jogoId}`, { marcadores }),

  recalcularMarcadores: (jogoId: number) =>
    api.patch<void>(`/marcadores-brasil/recalcular/${jogoId}`),

  getCandidatesAdmin: () =>
    api.get<{ id: number; nome: string; ativo: boolean }[]>('/marcadores-brasil/candidatos/admin'),

  createCandidate: (nome: string) =>
    api.post<void>('/marcadores-brasil/candidatos', { nome }),

  updateCandidate: (id: number, payload: { nome?: string; ativo?: boolean }) =>
    api.put<void>(`/marcadores-brasil/candidatos/${id}`, payload),
}
