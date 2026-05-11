import { useCallback, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'

const LS_KEY = 'bolao_owner_empresa_id'

export function useResolvedEmpresaForAdmin() {
  const { isOwner, empresaId } = useAuth()
  const [ownerEmpresaId, setOwnerEmpresaIdState] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(LS_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  })

  const setOwnerEmpresaId = useCallback((id: number) => {
    localStorage.setItem(LS_KEY, String(id))
    setOwnerEmpresaIdState(id)
  }, [])

  const resolvedEmpresaId = isOwner ? ownerEmpresaId : empresaId

  return {
    resolvedEmpresaId,
    setOwnerEmpresaId,
    needsOwnerEmpresaPick: isOwner,
  }
}
