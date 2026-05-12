const LS_TOKEN = 'bolao_access_token'
const REFRESH_PATH = '/auth/refresh'
const BOLAO_CLIENT_HEADER = 'X-Bolao-Client'
const BOLAO_CLIENT_VALUE = '1'

let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null

export function getToken(): string | null {
  return accessToken
}

export function setToken(token: string): void {
  accessToken = token
}

export function clearToken(): void {
  accessToken = null
}

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export { ApiError }

type RequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  _retryAfterRefresh?: boolean
}

function bolaoClientHeaders(): Record<string, string> {
  return { [BOLAO_CLIENT_HEADER]: BOLAO_CLIENT_VALUE }
}

async function tryRefreshToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(REFRESH_PATH, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...bolaoClientHeaders(),
      },
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as { access_token?: string }
        const token = data?.access_token
        if (token) {
          setToken(token)
          return token
        }
        return null
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  }

  if (path === REFRESH_PATH || path === '/auth/logout') {
    Object.assign(headers, bolaoClientHeaders())
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let body: string | undefined
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body,
    signal: opts.signal,
    credentials: 'include',
  })

  if (
    res.status === 401 &&
    token &&
    !opts._retryAfterRefresh &&
    path !== REFRESH_PATH &&
    path !== '/auth/logout'
  ) {
    const newToken = await tryRefreshToken()
    if (newToken) {
      return apiFetch<T>(path, { ...opts, _retryAfterRefresh: true })
    }
  }

  let data: unknown = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new CustomEvent('bolao:logout'))
    }

    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? typeof (data as { detail: unknown }).detail === 'string'
          ? (data as { detail: string }).detail
          : JSON.stringify((data as { detail: unknown }).detail)
        : res.statusText

    throw new ApiError(detail || 'Erro na requisição', res.status)
  }

  return data as T
}

/** POST multipart (ex.: upload). Repete uma vez após refresh de token em 401. */
export async function apiPostMultipart<T>(
  path: string,
  formData: FormData,
  opts: { _retryAfterRefresh?: boolean } = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include',
  })

  if (
    res.status === 401 &&
    token &&
    !opts._retryAfterRefresh &&
    path !== REFRESH_PATH &&
    path !== '/auth/logout'
  ) {
    const newToken = await tryRefreshToken()
    if (newToken) {
      return apiPostMultipart<T>(path, formData, { _retryAfterRefresh: true })
    }
  }

  let data: unknown = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new CustomEvent('bolao:logout'))
    }

    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? typeof (data as { detail: unknown }).detail === 'string'
          ? (data as { detail: string }).detail
          : JSON.stringify((data as { detail: unknown }).detail)
        : res.statusText

    throw new ApiError(detail || 'Erro na requisição', res.status)
  }

  return data as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    apiFetch<T>(path, { signal }),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body }),

  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
}

export async function bootstrapAccessTokenFromRefresh(): Promise<string | null> {
  if (accessToken) {
    return accessToken
  }
  return tryRefreshToken()
}

export function migrateLegacyAccessTokenStorage(): void {
  localStorage.removeItem(LS_TOKEN)
}
