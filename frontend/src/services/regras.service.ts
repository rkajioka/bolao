import { api } from '@/lib/api'
import type { ConfiguracaoBolao, PontuacaoFase } from '@/types'

export const regrasService = {
  getConfigMinha: () => api.get<ConfiguracaoBolao>('/configuracao-bolao/minha'),
  getFasesMinha: () => api.get<PontuacaoFase[]>('/configuracao-pontuacao-fase/minha'),
}
