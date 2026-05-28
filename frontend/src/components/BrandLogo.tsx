import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import logoLight from '@/assets/brand/logo.jpg'
import logoDark from '@/assets/brand/logo_escuro.png'

const VARIANT_CLASSES = {
  header: 'h-5 w-auto max-w-[72px] shrink-0 object-contain object-left',
  login: 'h-10 w-auto max-w-[140px] object-contain mx-auto',
} as const

type BrandLogoVariant = keyof typeof VARIANT_CLASSES

type BrandLogoProps = {
  variant?: BrandLogoVariant
  className?: string
  alt?: string
}

export function BrandLogo({ variant = 'header', className, alt }: BrandLogoProps) {
  const { isDark } = useTheme()
  const resolvedAlt = alt ?? (variant === 'header' ? 'LPC' : 'Bolão da Copa LPC')

  return (
    <img
      src={isDark ? logoDark : logoLight}
      alt={resolvedAlt}
      className={cn(VARIANT_CLASSES[variant], className)}
      loading={variant === 'header' ? 'eager' : undefined}
      decoding="async"
    />
  )
}
