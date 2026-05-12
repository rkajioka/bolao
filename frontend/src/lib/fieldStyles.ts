import type { CSSProperties } from 'react'

export type ThemeTone = 'accent' | 'highlight' | 'danger'

export const subduedSurfaceStyle: CSSProperties = {
  background: 'var(--segmented-bg)',
  border: '1px solid var(--border)',
}

export function toneSurfaceStyle(tone: ThemeTone): CSSProperties {
  return {
    background: `var(--${tone}-dim)`,
    border: '1px solid var(--border)',
  }
}

export function toneChipStyle(tone: ThemeTone): CSSProperties {
  return {
    background: `var(--${tone}-dim)`,
    color: `var(--${tone})`,
  }
}

export const fieldControlStyle: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
}

export const dropdownPanelStyle: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--elevated-shadow)',
}

export function dropdownOptionStyle({
  selected = false,
  focused = false,
}: {
  selected?: boolean
  focused?: boolean
}): CSSProperties {
  if (selected) {
    return { background: 'var(--accent-dim)', color: 'var(--text)' }
  }
  if (focused) {
    return { background: 'var(--glass-hover)', color: 'var(--text)' }
  }
  return { background: 'transparent', color: 'var(--text)' }
}
