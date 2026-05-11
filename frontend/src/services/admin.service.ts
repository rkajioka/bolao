import { api } from '@/lib/api'
import type {
  User,
  UsuarioEmailEntrega,
  Pais,
  ConfiguracaoBolao,
  PontuacaoFase,
  ResultadoEspecial,
  EmpresaTemaResponse,
  TemaTokensResponse,
} from '@/types'

function empresaQs(empresaId?: number | null): string {
  if (empresaId == null) return ''
  return `?empresa_id=${empresaId}`
}

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

export interface TemaTokensWrite {
  tokens_dark: Record<string, string>
  tokens_light: Record<string, string>
}

export interface CreateUserPayload {
  nome: string
  email: string
  senha_plana: string
  funcao?: string | null
  tipo_usuario: User['tipo_usuario']
  empresa_id?: number | null
  ativo?: boolean
  primeiro_login?: boolean
}

export interface UpdateUserPayload {
  nome?: string
  email?: string
  funcao?: string | null
  tipo_usuario?: User['tipo_usuario']
  empresa_id?: number | null
}

export const adminService = {
  getUsers: () => api.get<User[]>('/usuarios'),
  createUser: (data: CreateUserPayload) => api.post<User & UsuarioEmailEntrega>('/usuarios', data),
  updateUser: (id: number, data: UpdateUserPayload) => api.put<User>(`/usuarios/${id}`, data),
  toggleUserStatus: (id: number, ativo: boolean) =>
    api.patch<void>(`/usuarios/${id}/status`, { ativo }),
  resetUserPassword: (id: number) => api.patch<UsuarioEmailEntrega>(`/usuarios/${id}/reset-password`),

  getPaises: () => api.get<Pais[]>('/paises'),

  getConfig: (empresaId?: number | null) =>
    api.get<ConfiguracaoBolao>(`/configuracao-bolao${empresaQs(empresaId)}`),
  updateConfig: (data: UpdateConfigPayload, empresaId?: number | null) =>
    api.put<ConfiguracaoBolao>(`/configuracao-bolao${empresaQs(empresaId)}`, data),

  getFases: (empresaId?: number | null) =>
    api.get<PontuacaoFase[]>(`/configuracao-pontuacao-fase${empresaQs(empresaId)}`),
  updateFases: (data: UpdateFasesPayload, empresaId?: number | null) =>
    api.put<void>(`/configuracao-pontuacao-fase${empresaQs(empresaId)}`, data),

  getResultadoEspecial: () =>
    api.get<ResultadoEspecial | null>('/resultados-especiais'),
  saveResultadoEspecial: (data: ResultadoEspecialPayload, exists: boolean) =>
    exists
      ? api.put<ResultadoEspecial>('/resultados-especiais', data)
      : api.post<ResultadoEspecial>('/resultados-especiais', data),
  finalizarResultadoEspecial: () =>
    api.patch<ResultadoEspecial>('/resultados-especiais/finalizar', {}),

  getPlataformaTema: () => api.get<TemaTokensResponse>('/plataforma/tema'),
  putPlataformaTema: (body: TemaTokensWrite) =>
    api.put<TemaTokensResponse>('/plataforma/tema', body),

  getEmpresaTema: (empresaId: number) =>
    api.get<EmpresaTemaResponse>(`/empresas/${empresaId}/tema`),
  putEmpresaTema: (empresaId: number, body: TemaTokensWrite) =>
    api.put<EmpresaTemaResponse>(`/empresas/${empresaId}/tema`, body),
}
