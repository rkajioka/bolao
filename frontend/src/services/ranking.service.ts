import { api } from '@/lib/api'
import type { RankingResponse, RankingInsights } from '@/types'

function empresaQs(empresaId?: number | null): string {
  if (empresaId == null) return ''
  return `?empresa_id=${empresaId}`
}

export const rankingService = {
  get: (empresaId?: number | null, signal?: AbortSignal) =>
    api.get<RankingResponse>(`/ranking${empresaQs(empresaId)}`, signal),

  getInsights: (empresaId?: number | null, signal?: AbortSignal) =>
    api.get<RankingInsights>(`/ranking/insights${empresaQs(empresaId)}`, signal),
}
