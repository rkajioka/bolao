import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, X, XCircle } from 'lucide-react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_STYLES: Record<
  Toast['type'],
  { icon: typeof CheckCircle; iconColor: string; iconBg: string; border: string }
> = {
  success: {
    icon: CheckCircle,
    iconColor: 'var(--accent)',
    iconBg: 'var(--accent-dim)',
    border: 'rgba(53, 208, 127, 0.28)',
  },
  error: {
    icon: XCircle,
    iconColor: 'var(--danger)',
    iconBg: 'var(--danger-dim)',
    border: 'rgba(255, 92, 122, 0.32)',
  },
  info: {
    icon: CheckCircle,
    iconColor: 'var(--text)',
    iconBg: 'rgba(255, 255, 255, 0.08)',
    border: 'var(--border)',
  },
}

const AUTO_DISMISS_MS = 8_000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-2), { id, message, type }])
    window.setTimeout(() => remove(id), AUTO_DISMISS_MS)
  }, [remove])

  const success = useCallback((message: string) => toast(message, 'success'), [toast])
  const error = useCallback((message: string) => toast(message, 'error'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div
        className="fixed inset-x-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ top: 'calc(var(--safe-top) + 4.25rem)' }}
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const style = TOAST_STYLES[t.type]
            const Icon = style.icon
            const isError = t.type === 'error'

            return (
              <motion.div
                key={t.id}
                role={isError ? 'alert' : 'status'}
                aria-live={isError ? 'assertive' : 'polite'}
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-3.5 py-3 shadow-lg"
                style={{
                  background: 'var(--topbar-bg)',
                  border: `1px solid ${style.border}`,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: 'var(--elevated-shadow)',
                  color: 'var(--text)',
                }}
              >
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: style.iconBg }}
                  aria-hidden="true"
                >
                  <Icon size={16} style={{ color: style.iconColor }} />
                </span>
                <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{t.message}</p>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Fechar notificação"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
