import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { MarcadorCandidato } from '@/types'

interface MarcadorItem {
  nome_jogador: string
  quantidade_gols: number
}

function clampMarcadoresAoPlacar(items: MarcadorItem[], golsBrasil: number): MarcadorItem[] {
  const g = Math.max(0, golsBrasil)
  let acc = 0
  return items.map((m) => {
    const qRaw = Math.min(Math.max(0, m.quantidade_gols), g)
    const q = Math.min(qRaw, Math.max(0, g - acc))
    acc += q
    return { nome_jogador: m.nome_jogador, quantidade_gols: q }
  })
}

function linhaInicial(golsBrasil: number): MarcadorItem[] {
  if (golsBrasil <= 0) return [{ nome_jogador: '', quantidade_gols: 0 }]
  return [{ nome_jogador: '', quantidade_gols: Math.min(1, golsBrasil) }]
}

interface BrazilScorersProps {
  marcadores: MarcadorItem[]
  candidatos: MarcadorCandidato[]
  golsBrasil: number
  bloqueado: boolean
  saving: boolean
  onSave: (marcadores: MarcadorItem[]) => Promise<void>
}

export function BrazilScorers({
  marcadores,
  candidatos,
  golsBrasil,
  bloqueado,
  saving,
  onSave,
}: BrazilScorersProps) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState<MarcadorItem[]>(() =>
    marcadores.length > 0 ? clampMarcadoresAoPlacar(marcadores, golsBrasil) : linhaInicial(golsBrasil),
  )

  useEffect(() => {
    const base =
      marcadores.length > 0 ? marcadores : golsBrasil <= 0 ? [{ nome_jogador: '', quantidade_gols: 0 }] : linhaInicial(golsBrasil)
    setLocal(clampMarcadoresAoPlacar(base, golsBrasil))
  }, [marcadores, golsBrasil])

  const handleSave = async () => {
    if (golsBrasil <= 0) {
      await onSave([])
      return
    }
    const valid = local.filter((m) => m.nome_jogador.trim() && m.quantidade_gols > 0)
    await onSave(valid)
  }

  const setQuantidade = (i: number, raw: number) => {
    const g = Math.max(0, golsBrasil)
    const v = Math.max(0, Math.min(Number.isFinite(raw) ? raw : 0, g))
    setLocal((prev) => {
      const others = prev.reduce((s, m, j) => (j === i ? s : s + m.quantidade_gols), 0)
      const capped = Math.min(v, Math.max(0, g - others))
      const next = [...prev]
      next[i] = { ...next[i], quantidade_gols: capped }
      return next
    })
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
              {golsBrasil <= 0 && (
                <p className="text-xs px-0.5" style={{ color: 'var(--text-muted)' }}>
                  Com 0 gols do Brasil no palpite, não há marcadores para informar. Use Salvar para limpar marcadores
                  já registrados.
                </p>
              )}
              {golsBrasil > 0 && candidatos.length === 0 && (
                <p className="text-xs px-0.5" style={{ color: 'var(--text-muted)' }}>
                  Nenhum jogador cadastrado como candidato. Peça a um admin para incluir nomes no painel.
                </p>
              )}
              {golsBrasil > 0 &&
                local.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={m.nome_jogador}
                    onChange={(e) => {
                      const next = [...local]
                      next[i] = { ...next[i], nome_jogador: e.target.value }
                      setLocal(next)
                    }}
                    disabled={bloqueado || golsBrasil <= 0}
                    className="min-w-0 flex-1 px-3 py-2 rounded-xl text-sm disabled:opacity-40"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: 'var(--text)',
                    }}
                    aria-label={`Jogador marcador ${i + 1}`}
                  >
                    <option value="">Selecione o jogador</option>
                    {candidatos.map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={golsBrasil}
                    aria-label={`Gols do jogador ${i + 1}`}
                    value={m.quantidade_gols}
                    onChange={(e) => setQuantidade(i, parseInt(e.target.value, 10) || 0)}
                    disabled={bloqueado || golsBrasil <= 0}
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
                {!bloqueado && golsBrasil > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLocal((prev) => {
                        const next = [...prev, { nome_jogador: '', quantidade_gols: Math.min(1, golsBrasil) }]
                        return clampMarcadoresAoPlacar(next, golsBrasil)
                      })
                    }
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
