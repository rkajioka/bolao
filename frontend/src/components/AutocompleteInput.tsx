import { useEffect, useMemo, useRef, useState } from 'react'

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
}

export function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const filteredOptions = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options.slice(0, 30)
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 30)
  }, [options, value])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="relative flex-1" ref={ref}>
      <input
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm disabled:opacity-40 outline-none"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'var(--text)',
        }}
      />
      {open && !disabled && filteredOptions.length > 0 && (
        <div
          className="absolute z-40 mt-1 w-full max-h-44 overflow-auto rounded-xl p-1"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 22px rgba(0,0,0,0.25)',
          }}
        >
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm"
              style={{ color: 'var(--text)' }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
