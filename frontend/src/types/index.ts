export interface User {
  id: number
  nome: string
  email: string
  funcao: string | null
  imagem_perfil: string | null
  avatar_url: string | null
  tipo_usuario: 'usuario' | 'admin' | 'owner'
  ativo: boolean
  bloqueado: boolean
  primeiro_login: boolean
  empresa_id: number | null
  empresa_nome?: string | null
}

export interface Empresa {
  id: number
  nome: string
  codigo_empresa: string
  ativo: boolean
  marcadores_brasil_habilitado: boolean
  max_usuarios: number
  total_usuarios: number
  convites_pendentes: number
  vagas_restantes: number
  created_at: string
  updated_at: string
}

export interface ConviteResultado {
  email: string
  status: 'convite_criado' | 'convite_pendente' | 'ja_cadastrado' | 'limite_usuarios' | 'falha_requisicao'
  expiracao?: string
  convite_enviado_por_email?: boolean
  email_tentativas?: number
  email_erro?: string | null
}

export interface ConviteResumoEnvio {
  total: number
  enviados: number
  falhas: number
  bloqueados_limite: number
  alerta_admins_enviado: boolean
  alerta_owners_limite_enviado: boolean
}

export interface BulkConviteResponse {
  itens: ConviteResultado[]
  resumo_envio: ConviteResumoEnvio
}

export interface UsuarioEmailEntrega {
  email_enviado?: boolean | null
  email_erro?: string | null
  email_tentativas?: number | null
  alerta_admins_enviado?: boolean
}

export interface MembroEquipe {
  tipo: 'usuario' | 'convite'
  // campos de usuário
  id?: number
  nome?: string
  email: string
  funcao?: string | null
  avatar_url?: string | null
  tipo_usuario?: 'usuario' | 'admin' | 'owner'
  ativo?: boolean
  bloqueado?: boolean
  primeiro_login?: boolean
  ultimo_login?: string | null
  created_at: string
  // campos de convite
  convite_id?: number
  expiracao?: string
  status?: string
  criado_por?: number | null
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
  pontuacao_campeao: number
  pontuacao_vice_campeao: number
  pontuacao_terceiro_lugar: number
  pontuacao_artilheiro_pais: number
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

export interface InsightMetricaEmpresa {
  chave: string
  label: string
  valor: number
  total?: number | null
}

export interface DestaquesUsuarios {
  pontos_bloco: InsightDestaque[]
  placar_exato: InsightDestaque[]
  resultado: InsightDestaque[]
  classificado: InsightDestaque[]
}

export interface RankingInsights {
  periodo_chave: string | null
  periodo_label: string
  periodo_tipo: 'rodada_grupos' | 'fase_mata_mata' | 'sem_periodo'
  periodo_status: 'aguardando_primeiro_bloco' | 'disponivel' | 'bloco_em_andamento'
  periodo_em_andamento_label: string | null
  jogos_periodo: number
  participantes_empresa: number
  participantes_com_palpite_no_bloco: number
  metricas_empresa: InsightMetricaEmpresa[]
  destaques_usuarios: DestaquesUsuarios
  meu_preenchidos: number
  meu_acertos_resultado: number
  meu_acertos_placar_exato: number
  meus_acertos_classificado: number
  meus_pontos_periodo: number
  minha_posicao_periodo: number | null
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
  empresa_id?: number
  marcadores_brasil_habilitado?: boolean
  data_bloqueio_palpites_especiais: string | null
  data_bloqueio_palpites_especiais_efetiva?: string | null
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

export interface PontuacaoFase {
  id: number
  fase_key: string
  label: string
  ordem: number
  pontos_placar_exato: number
  pontos_resultado_correto: number
  pontos_classificado_mata_mata: number
}

export interface ResultadoEspecial {
  id: number
  campeao_id: number | null
  vice_campeao_id: number | null
  terceiro_lugar_id: number | null
  artilheiro_pais_id: number | null
  finalizado: boolean
  created_at: string
  updated_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  primeiro_login: boolean
}

export interface AtivarContaResponse {
  access_token: string
  token_type: string
}

export interface ApiError {
  detail: string
}

/** Resposta de tema da plataforma ou overlay por empresa (tokens CSS). */
export interface TemaTokensResponse {
  tokens_dark: Record<string, string>
  tokens_light: Record<string, string>
  updated_at?: string | null
}

export interface EmpresaTemaResponse extends TemaTokensResponse {
  empresa_id: number
}
