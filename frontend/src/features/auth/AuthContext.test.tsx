// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

let tokenState: string | null = null

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  bootstrapAccessTokenFromRefresh: vi.fn().mockResolvedValue(null),
  clearToken: vi.fn(() => {
    tokenState = null
  }),
  getToken: vi.fn(() => tokenState),
  migrateLegacyAccessTokenStorage: vi.fn(),
  setToken: vi.fn((value: string) => {
    tokenState = value
  }),
}))

import { api, setToken } from '@/lib/api'

function Probe() {
  const { adoptSession, isAuthenticated, refreshUser } = useAuth()
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <button
        type="button"
        onClick={async () => {
          adoptSession('token-teste')
          await refreshUser()
        }}
      >
        Adotar
      </button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    tokenState = null
    vi.mocked(api.get).mockReset()
    vi.mocked(setToken).mockClear()
  })

  it('adoptSession autentica após refreshUser', async () => {
    vi.mocked(api.get).mockResolvedValue({
      id: 1,
      nome: 'Usuário',
      email: 'user@example.com',
      tipo_usuario: 'usuario',
      primeiro_login: false,
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('no')
    })

    screen.getByRole('button', { name: 'Adotar' }).click()

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('yes')
    })
    expect(setToken).toHaveBeenCalledWith('token-teste')
  })
})
