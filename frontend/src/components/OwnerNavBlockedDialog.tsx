import { useEffect, useId } from 'react'
import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface OwnerNavBlockedDialogProps {
  sectionLabel: string
  onClose: () => void
}

export function OwnerNavBlockedDialog({ sectionLabel, onClose }: OwnerNavBlockedDialogProps) {
  const { isDark } = useTheme()
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar aviso"
        className="absolute inset-0"
        style={{ background: 'rgba(7, 10, 18, 0.72)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative w-full max-w-sm rounded-2xl p-5"
        style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
      >
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          <Info size={20} />
        </motion.div>
        <h2 id={titleId} className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>
          {sectionLabel} indisponível
        </h2>
        <p id={descriptionId} className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          O proprietário da plataforma não tem funcionalidade nesta tela.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: isDark ? '#070A12' : '#fff' }}
        >
          Entendi
        </button>
      </motion.div>
    </div>
  )
}
