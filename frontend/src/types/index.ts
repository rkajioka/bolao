export interface User {
  id: number
  nome: string
  email: string
  funcao: string
  imagem_perfil: string | null
  tipo_usuario: 'admin' | 'usuario'
  ativo: boolean
  primeiro_login: boolean
}

export interface Pais {
  id: number
  nome: string
  sigla: string
  grupo: string | null
  bandeira_url: string | null
}

export interface Jogo {
  id: number
  fase: string
  grupo: string | null
  tipo_fase: 'grupos' | 'mata_mata'
  rodada: number | null
  pais_casa_id: number
  pais_fora_id: number
  pais_casa: Pais
  pais_fora: Pais
  data_jogo: string
  placar_casa: number | null
  placar_fora: number | null
  teve_prorrogacao: boolean
  foi_para_penaltis: boolean
  penaltis_casa: number | null
  penaltis_fora: number | null
  classificado_id: number | null
  finalizado: boolean
}

export interface PalpiteJogo {
  id: number
  usuario_id: number
  jogo_id: number
  palpite_casa: number | null
  palpite_fora: number | null
  palpite_classificado_id: number | null
  pontuacao_placar: number
  pontuacao_resultado: number
  pontuacao_classificado: number
  pontuacao_marcadores_brasil: number
  pontuacao_total: number
  jogo?: Jogo
}

export interface PalpiteEspecial {
  id: number
  usuario_id: number
  campeao_id: number | null
  vice_campeao_id: number | null
  terceiro_lugar_id: number | null
  artilheiro_pais_id: number | null
  melhor_jogador: string | null
  artilheiro: string | null
  melhor_goleiro: string | null
  pontuacao_campeao: number
  pontuacao_vice_campeao: number
  pontuacao_terceiro_lugar: number
  pontuacao_artilheiro_pais: number
  pontuacao_melhor_jogador: number
  pontuacao_artilheiro: number
  pontuacao_melhor_goleiro: number
  pontuacao_total: number
  bloqueado: boolean
  campeao?: Pais
  vice_campeao?: Pais
  terceiro_lugar?: Pais
  artilheiro_pais?: Pais
}

export interface RankingLinha {
  posicao: number
  usuario_id: number
  nome: string
  funcao: string
  imagem_perfil: string | null
  campeao_id?: number | null
  vice_campeao_id?: number | null
  terceiro_lugar_id?: number | null
  artilheiro_pais_id?: number | null
  pontos_jogos: number
  pontos_especiais: number
  bonus_brasil: number
  pontos_totais: number
}

export interface RankingResponse {
  linhas: RankingLinha[]
}

export interface InsightDestaque {
  usuario_id: number
  nome: string
  valor: number
}

export interface RankingInsights {
  periodo_label: string
  periodo_tipo: 'rodada_grupos' | 'fase_mata_mata' | 'sem_periodo'
  jogos_periodo: number
  destaques_resultado: InsightDestaque[]
  destaques_placar_exato: InsightDestaque[]
  destaques_marcadores_br: InsightDestaque[]
  meu_preenchidos: number
  meu_acertos_resultado: number
  meu_acertos_placar_exato: number
  meu_bonus_marcadores_br: number
  meus_pontos_periodo: number
}

export interface MarcadorPalpite {
  id?: number
  nome_jogador: string
  quantidade_gols: number
}

export interface MarcadorCandidato {
  id: number
  nome: string
}

export interface GrupoTabela {
  posicao: number
  pais_id: number
  nome: string
  sigla: string
  bandeira_url: string
  pontos: number
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  gols_pro: number
  gols_contra: number
  saldo_gols: number
}

export interface GruposListResponse {
  grupos: string[]
}

export interface TabelaGrupoResponse {
  grupo: string
  linhas: GrupoTabela[]
}

export interface ConfiguracaoBolao {
  id: number
  data_bloqueio_palpites_especiais: string | null
  pontos_campeao: number
  pontos_vice_campeao: number
  pontos_terceiro_lugar: number
  pontos_artilheiro_pais: number
  pontos_melhor_jogador: number
  pontos_artilheiro: number
  pontos_melhor_goleiro: number
  pontos_placar_exato: number
  pontos_resultado_correto: number
  pontos_classificado_mata_mata: number
  pontos_marcador_brasil: number
  pontos_marcador_brasil_com_quantidade: number
}

export interface PontuacaoFase {
  id: number
  fase_key: string
  label: string
  ordem: number
  pontos_placar_exato: number
  pontos_resultado_correto: number
  pontos_classificado_mata_mata: number
}

export interface LoginResponse {
  access_token: string
  token_type: string
  primeiro_login: boolean
}

export interface ApiError {
  detail: string
}
