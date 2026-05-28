import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

export const BRAND_LOGO_LIGHT = '/logo.jpg'
export const BRAND_LOGO_DARK = '/logo_escuro.png'

type BrandLogoProps = {
  className?: string
  alt?: string
}

export function BrandLogo({ className, alt = 'Bolão da Copa LPC' }: BrandLogoProps) {
  const { isDark } = useTheme()

  return (
    <img
      src={isDark ? BRAND_LOGO_DARK : BRAND_LOGO_LIGHT}
      alt={alt}
      className={cn('object-contain rounded-lg', className)}
    />
  )
}
