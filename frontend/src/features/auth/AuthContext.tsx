import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react'
import { api, clearToken, getToken, setToken } from '@/lib/api'
import type { LoginResponse, User } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  /** Administrador da empresa ou proprietário da plataforma */
  isAdmin: boolean
  isOwner: boolean
  canManageTorneio: boolean
  canManageEquipe: boolean
  canParticipate: boolean
  canLancarResultadoOficial: boolean
  empresaId: number | null
}

interface AuthContextValue extends AuthState {
  login: (email: string, senha: string) => Promise<{ primeiro_login: boolean }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function computeRoles(user: User | null) {
  const isOwner = user?.tipo_usuario === 'owner'
  const isAdmin = user?.tipo_usuario === 'admin' || isOwner
  return {
    isOwner,
    isAdmin,
    canManageTorneio: isOwner,
    canManageEquipe: isAdmin,
    canParticipate: !isOwner,
    canLancarResultadoOficial: isOwner,
    empresaId: user?.empresa_id ?? null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(getToken)
  const [isLoading, setIsLoading] = useState<boolean>(() => !!getToken())

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // logout local deve ocorrer mesmo se a API falhar
    }
    clearToken()
    setTokenState(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const u = await api.get<User>('/auth/me')
      setUser(u)
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    const handleLogout = () => {
      void logout()
    }
    window.addEventListener('bolao:logout', handleLogout)
    return () => window.removeEventListener('bolao:logout', handleLogout)
  }, [logout])

  useEffect(() => {
    if (!token) {
      return
    }
    api.get<User>('/auth/me')
      .then(setUser)
      .catch(() => {
        void logout()
      })
      .finally(() => setIsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, senha: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { email, senha })
    setToken(res.access_token)
    setTokenState(res.access_token)
    if (!res.primeiro_login) {
      const u = await api.get<User>('/auth/me')
      setUser(u)
    }
    return { primeiro_login: res.primeiro_login }
  }, [])

  const roles = useMemo(() => computeRoles(user), [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        isAdmin: roles.isAdmin,
        isOwner: roles.isOwner,
        canManageTorneio: roles.canManageTorneio,
        canManageEquipe: roles.canManageEquipe,
        canParticipate: roles.canParticipate,
        canLancarResultadoOficial: roles.canLancarResultadoOficial,
        empresaId: roles.empresaId,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
