import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  hoverable?: boolean
  as?: 'div' | 'article' | 'section' | 'li'
}

export function GlassPanel({ children, className, hoverable, as: Tag = 'div' }: GlassPanelProps) {
  return (
    <Tag
      className={cn(
        'glass rounded-2xl',
        hoverable && 'glass-hover cursor-pointer',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
