import { Minus, Plus } from 'lucide-react'

interface ScoreStepperProps {
  value: number | null
  onChange: (v: number) => void
  disabled?: boolean
  label?: string
  readOnly?: boolean
}

export function ScoreStepper({ value, onChange, disabled, label, readOnly = false }: ScoreStepperProps) {
  const current = value ?? 0

  const decrement = () => {
    if (!disabled && current > 0) onChange(current - 1)
  }

  const increment = () => {
    if (!disabled) onChange(current + 1)
  }

  if (readOnly) {
    return (
      <div
        className="box-border w-12 h-10 flex items-center justify-center rounded-xl text-center text-xl font-bold tabular-nums leading-none p-0"
        aria-label={label}
        style={{
          background: value !== null ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: value !== null ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {value !== null ? value : '–'}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0" aria-label={label}>
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || current === 0}
        className="w-10 h-10 rounded-l-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRight: 'none',
          color: 'var(--text-muted)',
        }}
        aria-label="Diminuir"
      >
        <Minus size={14} />
      </button>

      <div
        className="box-border w-12 h-10 flex items-center justify-center text-center text-xl font-bold tabular-nums leading-none p-0"
        style={{
          background: value !== null
            ? 'rgba(53,208,127,0.08)'
            : 'rgba(255,255,255,0.03)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          color: value !== null ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {value !== null ? value : '–'}
      </div>

      <button
        type="button"
        onClick={increment}
        disabled={disabled}
        className="w-10 h-10 rounded-r-xl flex items-center justify-center transition-all duration-150 disabled:opacity-30"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderLeft: 'none',
          color: 'var(--text-muted)',
        }}
        aria-label="Aumentar"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
