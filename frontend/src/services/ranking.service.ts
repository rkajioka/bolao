import { api } from '@/lib/api'
import type { RankingResponse, RankingInsights } from '@/types'

export const rankingService = {
  get: (signal?: AbortSignal) => api.get<RankingResponse>('/ranking', signal),

  getInsights: (signal?: AbortSignal) =>
    api.get<RankingInsights>('/ranking/insights', signal),
}
