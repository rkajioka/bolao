const LS_TOKEN = 'bolao_access_token'

export function getToken(): string | null {
  return localStorage.getItem(LS_TOKEN)
}

export function setToken(token: string): void {
  localStorage.setItem(LS_TOKEN, token)
}

export function clearToken(): void {
  localStorage.removeItem(LS_TOKEN)
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
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
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
  })

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
