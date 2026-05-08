import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { AutocompleteInput } from '@/components/AutocompleteInput'

interface MarcadorItem {
  nome_jogador: string
  quantidade_gols: number
}

interface BrazilScorersProps {
  marcadores: MarcadorItem[]
  candidatos: string[]
  bloqueado: boolean
  saving: boolean
  onSave: (marcadores: MarcadorItem[]) => Promise<void>
}

export function BrazilScorers({ marcadores, candidatos, bloqueado, saving, onSave }: BrazilScorersProps) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState<MarcadorItem[]>(
    marcadores.length > 0 ? marcadores : [{ nome_jogador: '', quantidade_gols: 1 }],
  )

  const handleSave = async () => {
    const valid = local.filter((m) => m.nome_jogador.trim() && m.quantidade_gols >= 0)
    await onSave(valid)
  }

  return (
    <div
      className="mt-3"
      style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 text-sm font-medium w-full"
        style={{ color: 'var(--highlight)' }}
      >
        <span>Marcadores do Brasil (bônus)</span>
        <ChevronDown
          size={16}
          className="ml-auto transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {local.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <AutocompleteInput
                    value={m.nome_jogador}
                    onChange={(val) => {
                      const next = [...local]
                      next[i] = { ...next[i], nome_jogador: val }
                      setLocal(next)
                    }}
                    options={candidatos}
                    disabled={bloqueado}
                    placeholder="Nome do jogador"
                  />
                  <input
                    type="number"
                    min={0}
                    aria-label={`Gols do jogador ${i + 1}`}
                    value={m.quantidade_gols}
                    onChange={(e) => {
                      const next = [...local]
                      next[i] = { ...next[i], quantidade_gols: parseInt(e.target.value) || 0 }
                      setLocal(next)
                    }}
                    disabled={bloqueado}
                    className="w-16 px-2 py-2 rounded-xl text-sm text-center font-bold disabled:opacity-40"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: 'var(--text)',
                    }}
                  />
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                {!bloqueado && (
                  <button
                    type="button"
                    onClick={() => setLocal((prev) => [...prev, { nome_jogador: '', quantidade_gols: 1 }])}
                    className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    + Adicionar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={bloqueado || saving}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
                  style={{
                    background: 'var(--highlight-dim)',
                    border: '1px solid rgba(246,198,91,0.3)',
                    color: 'var(--highlight)',
                  }}
                >
                  {saving ? 'Salvando…' : 'Salvar marcadores'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
