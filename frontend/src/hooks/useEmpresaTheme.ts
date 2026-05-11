import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { api } from '@/lib/api'
import type { EmpresaTemaResponse, TemaTokensResponse } from '@/types'

const THEME_TOKEN_KEYS = [
  'bg',
  'bg-2',
  'glass',
  'glass-hover',
  'border',
  'border-hover',
  'text',
  'text-muted',
  'accent',
  'accent-dim',
  'highlight',
  'highlight-dim',
  'danger',
  'danger-dim',
  'topbar-bg',
  'nav-bg',
  'segmented-bg',
  'segmented-border',
  'segmented-active-bg',
  'segmented-active-border',
  'theme-color',
] as const

function clearAppliedTokens() {
  const root = document.documentElement
  for (const k of THEME_TOKEN_KEYS) {
    root.style.removeProperty(`--${k}`)
  }
}

export function useEmpresaTheme() {
  const { user, isAuthenticated } = useAuth()
  const { theme } = useTheme()

  const { data } = useQuery({
    queryKey: ['tema-ui', user?.empresa_id ?? 'plataforma', theme],
    enabled: isAuthenticated,
    queryFn: async (): Promise<TemaTokensResponse> => {
      if (user?.empresa_id) {
        return api.get<EmpresaTemaResponse>(`/empresas/${user.empresa_id}/tema`)
      }
      return api.get<TemaTokensResponse>('/plataforma/tema')
    },
  })

  useEffect(() => {
    if (!isAuthenticated) {
      clearAppliedTokens()
      return
    }
    if (!data) return

    const tokens = theme === 'light' ? data.tokens_light : data.tokens_dark
    const root = document.documentElement
    for (const [key, value] of Object.entries(tokens)) {
      root.style.setProperty(`--${key}`, value)
    }
  }, [data, theme, isAuthenticated])

  useEffect(() => {
    const onLogout = () => clearAppliedTokens()
    window.addEventListener('bolao:logout', onLogout)
    return () => window.removeEventListener('bolao:logout', onLogout)
  }, [])
}
