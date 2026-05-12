import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { MarcadorCandidato } from '@/types'

interface MarcadorItem {
  nome_jogador: string
  quantidade_gols: number
}

function expandirMarcadoresSalvos(marcadores: MarcadorItem[]): MarcadorItem[] {
  const linhas: MarcadorItem[] = []
  for (const marcador of marcadores) {
    const quantidade = Math.max(0, marcador.quantidade_gols)
    for (let i = 0; i < quantidade; i += 1) {
      linhas.push({ nome_jogador: marcador.nome_jogador, quantidade_gols: 1 })
    }
  }
  return linhas
}

function sincronizarLinhasMarcadores(marcadores: MarcadorItem[], golsBrasil: number): MarcadorItem[] {
  if (golsBrasil <= 0) return []

  const base = marcadores.length > 0 ? expandirMarcadoresSalvos(marcadores) : []
  const linhas = base.slice(0, golsBrasil).map((marcador) => ({
    nome_jogador: marcador.nome_jogador,
    quantidade_gols: 1,
  }))

  while (linhas.length < golsBrasil) {
    linhas.push({ nome_jogador: '', quantidade_gols: 1 })
  }

  return linhas
}

interface BrazilScorersProps {
  marcadores: MarcadorItem[]
  candidatos: MarcadorCandidato[]
  golsBrasil: number
  bloqueado: boolean
  saving: boolean
  onSave: (marcadores: MarcadorItem[]) => Promise<void>
  variant?: 'palpite' | 'resultado'
}

export function BrazilScorers({
  marcadores,
  candidatos,
  golsBrasil,
  bloqueado,
  saving,
  onSave,
  variant = 'palpite',
}: BrazilScorersProps) {
  const titulo = variant === 'resultado' ? 'Marcadores do Brasil (resultado)' : 'Marcadores do Brasil (bônus)'
  const referenciaGols = variant === 'resultado' ? 'resultado' : 'palpite'
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState<MarcadorItem[]>(() => sincronizarLinhasMarcadores(marcadores, golsBrasil))

  useEffect(() => {
    setLocal(sincronizarLinhasMarcadores(marcadores, golsBrasil))
  }, [marcadores, golsBrasil])

  const linhasIncompletas =
    golsBrasil > 0 && local.some((marcador) => !marcador.nome_jogador.trim())

  const handleSave = async () => {
    if (golsBrasil <= 0) {
      await onSave([])
      return
    }
    if (linhasIncompletas) return
    await onSave(local.map((marcador) => ({ nome_jogador: marcador.nome_jogador.trim(), quantidade_gols: 1 })))
  }

  return (
    <motion.div
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
        <span>{titulo}</span>
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
                  Com 0 gols do Brasil no {referenciaGols}, não há marcadores para informar.
                </p>
              )}
              {golsBrasil > 0 && (
                <p className="text-xs px-0.5" style={{ color: 'var(--text-muted)' }}>
                  Escolha exatamente {golsBrasil} jogador{golsBrasil === 1 ? '' : 'es'}, um por gol do Brasil no{' '}
                  {referenciaGols}. Para repetir um jogador, use linhas separadas.
                </p>
              )}
              {golsBrasil > 0 && candidatos.length === 0 && (
                <p className="text-xs px-0.5" style={{ color: 'var(--text-muted)' }}>
                  Nenhum jogador cadastrado como candidato. Peça a um admin para incluir nomes no painel.
                </p>
              )}
              {golsBrasil > 0 &&
                local.map((marcador, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span
                      className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <select
                      value={marcador.nome_jogador}
                      onChange={(e) => {
                        const next = [...local]
                        next[i] = { ...next[i], nome_jogador: e.target.value, quantidade_gols: 1 }
                        setLocal(next)
                      }}
                      disabled={bloqueado}
                      className="min-w-0 flex-1 px-3 py-2 rounded-xl text-sm disabled:opacity-40"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        color: 'var(--text)',
                      }}
                      aria-label={`Jogador marcador ${i + 1}`}
                    >
                      <option value="">Selecione o jogador</option>
                      {candidatos.map((candidato) => (
                        <option key={candidato.id} value={candidato.nome}>
                          {candidato.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

              {golsBrasil > 0 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={bloqueado || saving || linhasIncompletas}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
                    style={{
                      background: 'var(--highlight-dim)',
                      border: '1px solid rgba(246,198,91,0.3)',
                      color: 'var(--highlight)',
                    }}
                  >
                    {saving ? 'Salvando…' : 'Salvar marcadores'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
