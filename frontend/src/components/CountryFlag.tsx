import { flagImgUrl } from '@/lib/utils'
import type { Pais } from '@/types'

interface CountryFlagProps {
  pais: Pais
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  xs: { width: 20, height: 14, radius: 2 },
  sm: { width: 28, height: 20, radius: 3 },
  md: { width: 40, height: 28, radius: 4 },
  lg: { width: 56, height: 40, radius: 6 },
}

export function CountryFlag({ pais, size = 'md', className }: CountryFlagProps) {
  const { width, height, radius } = sizes[size]
  const url = flagImgUrl(pais.bandeira_url)

  if (!url) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          borderRadius: radius,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size === 'xs' ? 8 : size === 'sm' ? 10 : size === 'md' ? 12 : 16,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
          flexShrink: 0,
        }}
      >
        {pais.sigla?.slice(0, 2)}
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={pais.nome}
      width={width}
      height={height}
      loading="lazy"
      className={className}
      style={{
        borderRadius: radius,
        border: '1px solid rgba(255,255,255,0.12)',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  )
}
