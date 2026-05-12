import { Minus, Plus } from 'lucide-react'
import { type ChangeEvent, useEffect, useState } from 'react'

interface ScoreStepperProps {
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
  label?: string
  readOnly?: boolean
}

const MAX_SCORE = 99

function clampScore(value: number) {
  return Math.min(Math.max(value, 0), MAX_SCORE)
}

function digitsOnly(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 2)
}

function parseScore(text: string): number | null {
  if (text === '') return null
  return clampScore(Number(text))
}

export function ScoreStepper({ value, onChange, disabled, label, readOnly = false }: ScoreStepperProps) {
  const [draft, setDraft] = useState(() => (value === null ? '' : String(value)))

  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])

  const decrement = () => {
    if (!disabled && value !== null && value > 0) onChange(value - 1)
  }

  const increment = () => {
    if (!disabled) onChange(value === null ? 0 : clampScore(value + 1))
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextText = digitsOnly(event.target.value)
    setDraft(nextText)
    onChange(parseScore(nextText))
  }

  const handleBlur = () => {
    setDraft(value === null ? '' : String(value))
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
        tabIndex={-1}
        onClick={decrement}
        disabled={disabled || value === null || value === 0}
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

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        aria-label={label}
        placeholder="–"
        data-score-input=""
        className="box-border w-12 h-10 text-center text-xl font-bold tabular-nums leading-none p-0 outline-none transition-colors duration-150 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[rgba(53,208,127,0.45)]"
        style={{
          background: value !== null
            ? 'rgba(53,208,127,0.08)'
            : 'rgba(255,255,255,0.03)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          borderLeft: 'none',
          borderRight: 'none',
          color: value !== null ? 'var(--text)' : 'var(--text-muted)',
        }}
      />

      <button
        type="button"
        tabIndex={-1}
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
