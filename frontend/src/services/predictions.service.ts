import { api } from '@/lib/api'
import type { PalpiteJogo, MarcadorCandidato } from '@/types'

export interface CreatePalpitePayload {
  jogo_id: number
  palpite_casa: number
  palpite_fora: number
  palpite_classificado_id: number | null
}

export interface UpdatePalpitePayload {
  palpite_casa: number
  palpite_fora: number
  palpite_classificado_id: number | null
}

export interface MarcadorItem {
  nome_jogador: string
  quantidade_gols: number
}

export const predictionsService = {
  getMine: (signal?: AbortSignal) =>
    api.get<PalpiteJogo[]>('/palpites-jogos/me', signal),

  create: (data: CreatePalpitePayload) =>
    api.post<PalpiteJogo>('/palpites-jogos', data),

  update: (id: number, data: UpdatePalpitePayload) =>
    api.put<PalpiteJogo>(`/palpites-jogos/${id}`, data),

  getCandidates: (signal?: AbortSignal) =>
    api.get<MarcadorCandidato[]>('/marcadores-brasil/candidatos', signal),

  saveMarcadores: (jogoId: number, marcadores: MarcadorItem[]) =>
    api.put<void>(`/marcadores-brasil/${jogoId}`, { marcadores }),
}
