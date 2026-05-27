import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, Lock } from 'lucide-react'
import { CountryFlag } from '@/components/CountryFlag'
import { dropdownOptionStyle, dropdownPanelStyle, fieldControlStyle } from '@/lib/fieldStyles'
import type { Pais } from '@/types'

interface CountrySelectProps {
  value: string
  countries: Pais[]
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
  secured?: boolean
  excludedCountryIds?: number[]
  ariaLabel?: string
}

export function CountrySelect({
  value,
  countries,
  onChange,
  placeholder,
  disabled = false,
  secured = false,
  excludedCountryIds = [],
  ariaLabel,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selected = countries.find((c) => String(c.id) === value) ?? null

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [countries],
  )
  const excludedIds = useMemo(
    () => new Set(excludedCountryIds.filter((id) => id > 0)),
    [excludedCountryIds],
  )

  const selectableCountries = useMemo(
    () => sortedCountries.filter((c) => !excludedIds.has(c.id) || String(c.id) === value),
    [sortedCountries, excludedIds, value],
  )

  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return selectableCountries
    return selectableCountries.filter((c) => c.nome.toLowerCase().includes(q))
  }, [selectableCountries, query])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full px-3 py-3 rounded-xl text-sm transition-all duration-150 disabled:opacity-40 flex items-center gap-2"
        style={{
          ...fieldControlStyle,
          ...(secured
            ? {
                background: 'var(--segmented-bg)',
                border: '1px solid var(--border)',
              }
            : {}),
        }}
      >
        {selected ? (
          <>
            <CountryFlag pais={selected} size="sm" />
            <span className="truncate">{selected.nome}</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {secured ? (
            <Lock size={14} style={{ color: 'var(--text-muted)' }} aria-hidden />
          ) : null}
          <ChevronDown
            size={16}
            className="transition-transform duration-200"
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--text-muted)',
            }}
          />
        </span>
      </button>

      {open && (
        <div
          className="absolute z-40 mt-2 w-full max-h-64 overflow-auto rounded-xl p-1"
          style={dropdownPanelStyle}
        >
          <div className="p-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite para filtrar..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={fieldControlStyle}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              onChange('')
              setQuery('')
              setOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <span>{placeholder}</span>
          </button>

          {filteredCountries.map((country) => {
            const isSelected = String(country.id) === value
            return (
              <button
                key={country.id}
                type="button"
                onClick={() => {
                  onChange(String(country.id))
                  setQuery('')
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors"
                style={dropdownOptionStyle({ selected: isSelected })}
              >
                <CountryFlag pais={country} size="sm" />
                <span className="truncate flex-1">{country.nome}</span>
                {isSelected ? <Check size={14} style={{ color: 'var(--accent)' }} /> : null}
              </button>
            )
          })}
          {filteredCountries.length === 0 && (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Nenhum país encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
