import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/features/auth/AuthContext'
import { useCookieConsent } from '@/hooks/useCookieConsent'

export function CookieBanner() {
  const { consent, accept, reject } = useCookieConsent()
  const { isAuthenticated } = useAuth()

  return (
    <AnimatePresence>
      {consent === null && (
        <motion.div
          key="cookie-banner"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          className="fixed left-0 right-0 z-[70] px-4 pointer-events-none"
          style={{
            bottom: isAuthenticated
              ? 'calc(var(--nav-h) + var(--safe-bottom) + 10px)'
              : 'calc(var(--safe-bottom) + 10px)',
          }}
        >
          <div
            className="max-w-2xl mx-auto rounded-2xl p-4 pointer-events-auto"
            style={{
              background: 'var(--topbar-bg)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: 'var(--elevated-shadow)',
            }}
          >
            <div className="flex items-start gap-3">
              {/* Ícone */}
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ background: 'var(--accent-dim)' }}
                aria-hidden="true"
              >
                🍪
              </span>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text)' }}>
                  Usamos cookies
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Utilizamos cookies essenciais para manter sua sessão autenticada e garantir o
                  funcionamento correto do bolão. Ao continuar, você concorda com nossa{' '}
                  <Link
                    to="/privacidade"
                    className="underline underline-offset-2 transition-opacity hover:opacity-80"
                    style={{ color: 'var(--accent)' }}
                  >
                    Política de Privacidade
                  </Link>
                  .
                </p>

                {/* Botões */}
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={reject}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                    style={{
                      background: 'var(--glass)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Rejeitar
                  </button>
                  <button
                    type="button"
                    onClick={accept}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                    style={{ background: 'var(--accent)', color: '#070A12' }}
                  >
                    Aceitar cookies
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
