import { api } from '@/lib/api'
import type { ConfiguracaoBolao, PontuacaoFase } from '@/types'

export type OverrideBloqueioEspeciaisModo = 'automatico' | 'travado' | 'destravado'

export const regrasService = {
  getConfigMinha: () => api.get<ConfiguracaoBolao>('/configuracao-bolao/minha'),
  getFasesMinha: () => api.get<PontuacaoFase[]>('/configuracao-pontuacao-fase/minha'),
  setOverrideBloqueioEspeciais: (modo: OverrideBloqueioEspeciaisModo) =>
    api.patch<ConfiguracaoBolao>('/configuracao-bolao/palpites-especiais-bloqueio', { modo }),
}
