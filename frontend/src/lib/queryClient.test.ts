import { describe, expect, it } from 'vitest'
import { queryClient } from './queryClient'

describe('queryClient', () => {
  it('usa staleTime global de 30 segundos', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(30_000)
  })

  it('usa gcTime de 5 minutos', () => {
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(5 * 60_000)
  })
})
