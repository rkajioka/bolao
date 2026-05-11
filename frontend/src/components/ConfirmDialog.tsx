import { useEffect, useId } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export type ConfirmDialogTone = 'default' | 'warning' | 'danger'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
  confirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const toneStyles: Record<
  ConfirmDialogTone,
  { iconBg: string; iconColor: string; confirmBg: string; confirmColor: string; confirmBorder?: string }
> = {
  default: {
    iconBg: 'var(--accent-dim)',
    iconColor: 'var(--accent)',
    confirmBg: 'var(--accent)',
    confirmColor: '#070A12',
  },
  warning: {
    iconBg: 'rgba(212,160,23,0.14)',
    iconColor: 'var(--highlight)',
    confirmBg: 'rgba(212,160,23,0.18)',
    confirmColor: 'var(--highlight)',
    confirmBorder: '1px solid rgba(212,160,23,0.35)',
  },
  danger: {
    iconBg: 'var(--danger-dim)',
    iconColor: 'var(--danger)',
    confirmBg: 'var(--danger-dim)',
    confirmColor: 'var(--danger)',
    confirmBorder: '1px solid rgba(255,92,122,0.35)',
  },
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { isDark } = useTheme()
  const titleId = useId()
  const descriptionId = useId()
  const styles = toneStyles[tone]
  const Icon = tone === 'default' ? Info : AlertTriangle

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, confirming, onCancel])

  if (!open) return null

  const confirmTextColor = tone === 'default' ? (isDark ? '#070A12' : '#fff') : styles.confirmColor

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fechar confirmação"
        className="absolute inset-0"
        style={{ background: 'rgba(7, 10, 18, 0.72)', backdropFilter: 'blur(4px)' }}
        onClick={confirming ? undefined : onCancel}
        disabled={confirming}
      />
      <motion.div
        role="alertdialog"
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
          style={{ background: styles.iconBg, color: styles.iconColor }}
        >
          <Icon size={20} />
        </motion.div>
        <h2 id={titleId} className="text-base font-semibold mb-2" style={{ color: 'var(--text)' }}>
          {title}
        </h2>
        <p id={descriptionId} className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--text)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: styles.confirmBg,
              color: confirmTextColor,
              border: styles.confirmBorder ?? 'none',
            }}
          >
            {confirming ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
