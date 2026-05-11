import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { IncomingMessage } from 'http'

const API_TARGET = 'http://localhost:8000'

/** Rotas do React Router que compartilham prefixo com a API. */
const SPA_HTML_EXACT_PATHS = new Set([
  '/jogos',
  '/ranking',
  '/grupos',
  '/perfil',
  '/equipe',
])

function normalizePath(url: string | undefined): string {
  const pathname = (url ?? '').split('?')[0] || '/'
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function isSpaHtmlNavigation(req: IncomingMessage): boolean {
  if (req.method !== 'GET') return false
  const accept = req.headers.accept ?? ''
  if (!accept.includes('text/html')) return false
  return SPA_HTML_EXACT_PATHS.has(normalizePath(req.url))
}

function apiProxy(spaHtmlExactPath?: string): ProxyOptions {
  return {
    target: API_TARGET,
    changeOrigin: true,
    bypass(req) {
      if (spaHtmlExactPath && normalizePath(req.url) === spaHtmlExactPath) {
        if (isSpaHtmlNavigation(req)) {
          return '/index.html'
        }
      }
      return undefined
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/auth': { target: API_TARGET, changeOrigin: true },
      '/paises': { target: API_TARGET, changeOrigin: true },
      '/jogos': apiProxy('/jogos'),
      '/palpites-jogos': { target: API_TARGET, changeOrigin: true },
      '/palpites-especiais': { target: API_TARGET, changeOrigin: true },
      '/marcadores-brasil': { target: API_TARGET, changeOrigin: true },
      '/ranking': apiProxy('/ranking'),
      '/grupos': apiProxy('/grupos'),
      '/usuarios': { target: API_TARGET, changeOrigin: true },
      '/configuracao-bolao': { target: API_TARGET, changeOrigin: true },
      '/configuracao-pontuacao-fase': { target: API_TARGET, changeOrigin: true },
      '/resultados-especiais': { target: API_TARGET, changeOrigin: true },
      '/empresas': { target: API_TARGET, changeOrigin: true },
      '/equipe': apiProxy('/equipe'),
      '/perfil': apiProxy('/perfil'),
      '/health': { target: API_TARGET, changeOrigin: true },
      '/static': { target: API_TARGET, changeOrigin: true },
    },
  },
})
