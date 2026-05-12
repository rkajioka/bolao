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

function displayValue(value: number | null): string {
  if (value === null) return ''
  return String(value)
}

function isUnset(value: number | null): boolean {
  return value === null
}

export function ScoreStepper({ value, onChange, disabled, label, readOnly = false }: ScoreStepperProps) {
  const [draft, setDraft] = useState(() => displayValue(value))

  useEffect(() => {
    setDraft(displayValue(value))
  }, [value])

  const decrement = () => {
    if (!disabled && value !== null) onChange(clampScore(value - 1))
  }

  const increment = () => {
    if (!disabled) onChange(clampScore(value === null ? 0 : value + 1))
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextText = digitsOnly(event.target.value)
    if (nextText === '') {
      setDraft('')
      return
    }
    setDraft(nextText)
    onChange(parseScore(nextText))
  }

  const handleBlur = () => {
    setDraft(displayValue(value))
  }

  if (readOnly) {
    return (
      <div
        className="box-border w-10 h-9 flex items-center justify-center rounded-lg text-center text-lg font-bold tabular-nums leading-none p-0 surface-input"
        aria-label={label}
        style={{ color: isUnset(value) ? 'var(--text-muted)' : 'var(--text)' }}
      >
        {isUnset(value) ? '–' : displayValue(value)}
      </div>
    )
  }

  const unset = isUnset(value)

  return (
    <div
      className="flex items-center overflow-hidden rounded-lg surface-input"
      aria-label={label}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={decrement}
        disabled={disabled || unset || value === 0}
        className="w-8 h-9 flex shrink-0 items-center justify-center border-0 bg-transparent transition-colors duration-150 disabled:opacity-30"
        style={{
          color: 'var(--text-muted)',
          borderRight: '1px solid var(--border)',
        }}
        aria-label="Diminuir"
      >
        <Minus size={12} />
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
        data-score-input=""
        placeholder={unset ? '–' : undefined}
        className="box-border h-9 w-10 shrink-0 border-0 bg-transparent p-0 text-center text-lg font-bold tabular-nums leading-none outline-none transition-colors duration-150 placeholder:font-bold placeholder:text-[var(--text-muted)] disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[rgba(53,208,127,0.45)]"
        style={{ color: unset ? 'var(--text-muted)' : 'var(--text)' }}
      />

      <button
        type="button"
        tabIndex={-1}
        onClick={increment}
        disabled={disabled}
        className="w-8 h-9 flex shrink-0 items-center justify-center border-0 bg-transparent transition-colors duration-150 disabled:opacity-30"
        style={{
          color: 'var(--text-muted)',
          borderLeft: '1px solid var(--border)',
        }}
        aria-label="Aumentar"
      >
        <Plus size={12} />
      </button>
    </div>
  )
}
