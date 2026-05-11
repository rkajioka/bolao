interface Segment<T extends string> {
  key: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[]
  value: T
  onChange: (value: T) => void
  controlId: string
  /** Muitos segmentos: rolagem horizontal em vez de dividir espaço igualmente. */
  scrollable?: boolean
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  controlId,
  scrollable = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={controlId}
      style={{
        display: 'flex',
        padding: '3px',
        borderRadius: '12px',
        background: 'var(--segmented-bg)',
        border: '1px solid var(--segmented-border)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        gap: '2px',
        flexWrap: scrollable ? 'nowrap' : undefined,
        overflowX: scrollable ? 'auto' : undefined,
        WebkitOverflowScrolling: scrollable ? 'touch' : undefined,
      }}
    >
      {segments.map((seg) => {
        const isActive = value === seg.key
        return (
          <button
            key={seg.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(seg.key)}
            style={{
              flex: scrollable ? '0 0 auto' : 1,
              padding: '6px 12px',
              borderRadius: '9px',
              fontSize: '13px',
              fontWeight: 600,
              border: isActive ? '1px solid var(--segmented-active-border)' : '1px solid transparent',
              background: isActive ? 'var(--segmented-active-bg)' : 'transparent',
              cursor: 'pointer',
              color: isActive ? 'var(--text)' : 'var(--text-muted)',
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              minHeight: '32px',
              letterSpacing: '-0.01em',
            }}
          >
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}
