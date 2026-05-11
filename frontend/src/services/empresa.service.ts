import { api } from '@/lib/api'
import type { Empresa } from '@/types'

export interface EmpresaCreatePayload {
  nome: string
}

export const empresaService = {
  listar: () => api.get<Empresa[]>('/empresas/'),
  criar: (data: EmpresaCreatePayload) => api.post<Empresa>('/empresas/', data),
}
