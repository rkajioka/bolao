import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, X } from 'lucide-react'

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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-2), { id, message, type }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  const success = useCallback((message: string) => toast(message, 'success'), [toast])
  const error = useCallback((message: string) => toast(message, 'error'), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <motion.div
        className="fixed inset-x-0 top-0 z-[200] flex flex-col gap-1.5 items-center pointer-events-none px-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-auto flex items-start gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg max-w-[min(92vw,28rem)]"
              style={{
                background: t.type === 'error'
                  ? 'rgba(40, 18, 22, 0.96)'
                  : 'rgba(12, 18, 32, 0.96)',
                border: `1px solid ${t.type === 'error'
                  ? 'rgba(255, 92, 122, 0.4)'
                  : t.type === 'success'
                    ? 'rgba(53, 208, 127, 0.3)'
                    : 'rgba(255,255,255,0.08)'}`,
                color: '#F8FAFC',
              }}
            >
              {t.type === 'success' && <CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />}
              {t.type === 'error' && <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />}
              <span className="flex-1 min-w-0 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                aria-label="Fechar aviso"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
