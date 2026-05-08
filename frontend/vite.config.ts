import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/paises': 'http://localhost:8000',
      '/jogos': 'http://localhost:8000',
      '/palpites-jogos': 'http://localhost:8000',
      '/palpites-especiais': 'http://localhost:8000',
      '/marcadores-brasil': 'http://localhost:8000',
      '/ranking': 'http://localhost:8000',
      '/grupos': 'http://localhost:8000',
      '/usuarios': 'http://localhost:8000',
      '/configuracao-bolao': 'http://localhost:8000',
      '/pontuacao-fase': 'http://localhost:8000',
      '/resultados-especiais': 'http://localhost:8000',
      '/empresas': 'http://localhost:8000',
      '/equipe': 'http://localhost:8000',
      '/perfil': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
    },
  },
})
