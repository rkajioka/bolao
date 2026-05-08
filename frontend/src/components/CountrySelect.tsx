import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { CountryFlag } from '@/components/CountryFlag'
import type { Pais } from '@/types'

interface CountrySelectProps {
  value: string
  countries: Pais[]
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
}

export function CountrySelect({
  value,
  countries,
  onChange,
  placeholder,
  disabled = false,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selected = countries.find((c) => String(c.id) === value) ?? null

  const sortedCountries = useMemo(
    () => [...countries].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [countries],
  )
  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sortedCountries
    return sortedCountries.filter((c) => c.nome.toLowerCase().includes(q))
  }, [sortedCountries, query])

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
        className="w-full px-3 py-3 rounded-xl text-sm transition-all duration-150 disabled:opacity-40 flex items-center gap-2"
        style={{
          background: 'var(--glass)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
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
        <ChevronDown
          size={16}
          className="ml-auto transition-transform duration-200"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute z-40 mt-2 w-full max-h-64 overflow-auto rounded-xl p-1"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
          }}
        >
          <div className="p-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite para filtrar..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
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
                style={{
                  background: isSelected ? 'rgba(53,208,127,0.12)' : 'transparent',
                  color: isSelected ? 'var(--text)' : 'var(--text)',
                }}
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
