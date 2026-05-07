import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {icon && (
        <div
          className="mb-4 w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {icon}
        </div>
      )}
      <p className="font-semibold text-base mb-1">{title}</p>
      {description && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
