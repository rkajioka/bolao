import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectInputProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
  disabled?: boolean
  className?: string
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
}: SelectInputProps) {
  const [open, setOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()

  const enabledOptions = useMemo(() => options.filter((opt) => !opt.disabled), [options])
  const selected = options.find((opt) => opt.value === value) ?? null

  const getInitialFocusedIndex = () => {
    const currentIndex = enabledOptions.findIndex((opt) => opt.value === value)
    return currentIndex >= 0 ? currentIndex : 0
  }

  const openDropdown = () => {
    if (!enabledOptions.length) return
    setFocusedIndex(getInitialFocusedIndex())
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, enabledOptions, value])

  const selectOption = (option: SelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return

    if (event.key === 'Tab' && open) {
      setOpen(false)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) {
        const option = enabledOptions[focusedIndex >= 0 ? focusedIndex : getInitialFocusedIndex()]
        if (option) selectOption(option)
      } else {
        openDropdown()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!enabledOptions.length) return
      if (!open) {
        openDropdown()
      } else {
        setFocusedIndex((prev) => {
          const i = prev < 0 ? getInitialFocusedIndex() : prev
          return i + 1 >= enabledOptions.length ? 0 : i + 1
        })
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open || !enabledOptions.length) return
      setFocusedIndex((prev) => {
        const i = prev < 0 ? getInitialFocusedIndex() : prev
        return i - 1 < 0 ? enabledOptions.length - 1 : i - 1
      })
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusedIndex((prev) => (prev + 1 >= enabledOptions.length ? 0 : prev + 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedIndex((prev) => (prev - 1 < 0 ? enabledOptions.length - 1 : prev - 1))
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = enabledOptions[focusedIndex]
      if (option) selectOption(option)
    }
  }

  return (
    <div className={`relative ${className}`.trim()} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (open) {
            setOpen(false)
          } else {
            openDropdown()
          }
        }}
        onKeyDown={onTriggerKeyDown}
        className="w-full px-3 py-2 rounded-xl text-sm transition-all duration-150 disabled:opacity-40 flex items-center gap-2 outline-none"
        style={{
          background: 'var(--glass)',
          border: '1px solid var(--border)',
          color: selected ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={16}
          className="ml-auto transition-transform duration-200 shrink-0"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)',
          }}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute z-50 mt-2 w-full max-h-64 overflow-auto rounded-xl p-1"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value
            const enabledIndex = enabledOptions.findIndex((item) => item.value === option.value)
            const isFocused = enabledIndex >= 0 && enabledIndex === focusedIndex
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseEnter={() => {
                  if (enabledIndex >= 0) setFocusedIndex(enabledIndex)
                }}
                onClick={() => selectOption(option)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm disabled:opacity-40"
                style={{
                  background: isFocused ? 'rgba(255,255,255,0.08)' : isSelected ? 'rgba(53,208,127,0.12)' : 'transparent',
                  color: isSelected ? 'var(--text)' : 'var(--text)',
                }}
              >
                <span className="truncate flex-1">{option.label}</span>
                {isSelected ? <Check size={14} style={{ color: 'var(--accent)' }} /> : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
