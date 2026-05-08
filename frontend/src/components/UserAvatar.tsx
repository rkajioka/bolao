import type { CSSProperties } from 'react'
import { User } from 'lucide-react'
import { cn, imgUrl } from '@/lib/utils'

const sizeMap = {
  sm: { box: 'w-8 h-8', icon: 14 },
  md: { box: 'w-9 h-9', icon: 16 },
  lg: { box: 'w-10 h-10', icon: 18 },
  xl: { box: 'w-16 h-16', icon: 28 },
} as const

export type UserAvatarSize = keyof typeof sizeMap

type UserAvatarProps = {
  src?: string | null
  alt?: string
  size?: UserAvatarSize
  rounded?: 'full' | 'xl' | '2xl'
  className?: string
  style?: CSSProperties
  /** Cor do ícone quando não há foto (ex.: pódio com cor da medalha) */
  fallbackIconColor?: string
}

export function UserAvatar({
  src,
  alt = '',
  size = 'md',
  rounded = 'full',
  className,
  style,
  fallbackIconColor,
}: UserAvatarProps) {
  const { box, icon } = sizeMap[size]
  const r = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-2xl'
  const resolved = src?.trim() ? src : null

  return (
    <div
      className={cn(box, r, 'flex items-center justify-center overflow-hidden shrink-0', className)}
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        ...style,
      }}
    >
      {resolved ? (
        <img src={imgUrl(resolved)} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <User size={icon} style={{ color: fallbackIconColor ?? 'var(--text-muted)' }} aria-hidden />
      )}
    </div>
  )
}
