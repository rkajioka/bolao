import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, clearToken, setToken } from './api'

describe('apiFetch', () => {
  beforeEach(() => {
    clearToken()
    setToken('token-antigo')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearToken()
  })

  it('repete a requisição após refresh em 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-novo' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiFetch<{ ok: boolean }>('/perfil')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('expõe ApiError com status', () => {
    const error = new ApiError('Falha', 400)
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(400)
    expect(error.message).toBe('Falha')
  })
})
