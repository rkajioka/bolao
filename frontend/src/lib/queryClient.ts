import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof Error && 'status' in error) {
          const status = (error as { status: number }).status
          if (status === 401 || status === 403 || status === 404) return false
          if (status >= 500) return failureCount < 2
          return false
        }
        return failureCount < 2
      },
    },
  },
})
