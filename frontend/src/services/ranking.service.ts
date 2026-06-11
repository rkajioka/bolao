import { api } from '@/lib/api'
import type { RankingResponse, RankingInsights } from '@/types'

/** Prefixo /api evita colisão Nginx entre SPA (/ranking) e FastAPI. */
const RANKING_API = '/api/ranking'

function empresaQs(empresaId?: number | null): string {
  if (empresaId == null) return ''
  return `?empresa_id=${empresaId}`
}

export const rankingService = {
  get: (empresaId?: number | null, signal?: AbortSignal) =>
    api.get<RankingResponse>(`${RANKING_API}${empresaQs(empresaId)}`, signal),

  getInsights: (empresaId?: number | null, signal?: AbortSignal) =>
    api.get<RankingInsights>(`${RANKING_API}/insights${empresaQs(empresaId)}`, signal),
}
