import { cn } from '@/lib/utils'

type Status = 'open' | 'locked' | 'done'

interface MatchStatusBadgeProps {
  status: Status
  className?: string
}

const config = {
  open: {
    label: 'Palpite aberto',
    textColor: 'var(--text)',
    surface: { background: 'var(--accent-dim)', border: '1px solid var(--border)' },
    dot: true,
    dotColor: 'var(--accent)',
  },
  locked: {
    label: 'Palpite fechado',
    textColor: 'var(--text-muted)',
    surface: { background: 'var(--segmented-bg)', border: '1px solid var(--border)' },
    dot: false,
    dotColor: 'var(--text-muted)',
  },
  done: {
    label: 'Finalizado',
    textColor: 'var(--text)',
    surface: { background: 'var(--highlight-dim)', border: '1px solid var(--border)' },
    dot: false,
    dotColor: 'var(--highlight)',
  },
}

export function MatchStatusBadge({ status, className }: MatchStatusBadgeProps) {
  const c = config[status]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', className)}
      style={{ color: c.textColor, ...c.surface }}
    >
      {c.dot && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: c.dotColor }}
        />
      )}
      {c.label}
    </span>
  )
}
