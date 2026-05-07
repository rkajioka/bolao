import { cn } from '@/lib/utils'

type Status = 'open' | 'locked' | 'done'

interface MatchStatusBadgeProps {
  status: Status
  className?: string
}

const config = {
  open: {
    label: 'Palpite aberto',
    color: 'var(--accent)',
    bg: 'var(--accent-dim)',
    border: 'rgba(53,208,127,0.3)',
    dot: true,
  },
  locked: {
    label: 'Palpite fechado',
    color: 'var(--text-muted)',
    bg: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.08)',
    dot: false,
  },
  done: {
    label: 'Finalizado',
    color: 'var(--highlight)',
    bg: 'var(--highlight-dim)',
    border: 'rgba(246,198,91,0.3)',
    dot: false,
  },
}

export function MatchStatusBadge({ status, className }: MatchStatusBadgeProps) {
  const c = config[status]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold', className)}
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
    >
      {c.dot && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: c.color }}
        />
      )}
      {c.label}
    </span>
  )
}
