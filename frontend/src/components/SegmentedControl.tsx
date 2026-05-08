import { motion } from 'framer-motion'

interface Segment<T extends string> {
  key: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[]
  value: T
  onChange: (value: T) => void
  controlId: string
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  controlId,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        padding: '3px',
        borderRadius: '12px',
        background: 'var(--segmented-bg)',
        border: '1px solid var(--segmented-border)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        gap: '2px',
      }}
    >
      {segments.map((seg) => (
        <button
          key={seg.key}
          role="tab"
          type="button"
          aria-selected={value === seg.key}
          onClick={() => onChange(seg.key)}
          style={{
            flex: 1,
            position: 'relative',
            padding: '6px 12px',
            borderRadius: '9px',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: value === seg.key ? 'var(--text)' : 'var(--text-muted)',
            transition: 'color 150ms ease',
            minHeight: '32px',
            letterSpacing: '-0.01em',
          }}
        >
          {value === seg.key && (
            <motion.span
              layoutId={controlId}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '9px',
                background: 'var(--segmented-active-bg)',
                border: '1px solid var(--segmented-active-border)',
                zIndex: -1,
              }}
              transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }}
            />
          )}
          {seg.label}
        </button>
      ))}
    </div>
  )
}
