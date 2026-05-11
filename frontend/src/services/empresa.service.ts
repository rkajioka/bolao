import { api } from '@/lib/api'
import type { Empresa } from '@/types'

export interface EmpresaCreatePayload {
  nome: string
  marcadores_brasil_habilitado?: boolean
}

export interface EmpresaUpdatePayload {
  marcadores_brasil_habilitado?: boolean
  nome?: string
  ativo?: boolean
}

export const empresaService = {
  listar: () => api.get<Empresa[]>('/empresas/'),
  criar: (data: EmpresaCreatePayload) => api.post<Empresa>('/empresas/', data),
  atualizar: (id: number, data: EmpresaUpdatePayload) => api.patch<Empresa>(`/empresas/${id}`, data),
}
