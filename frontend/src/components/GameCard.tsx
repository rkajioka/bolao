import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Trophy, Save } from 'lucide-react'
import { CountryFlag } from './CountryFlag'
import { ScoreStepper } from './ScoreStepper'
import { MatchStatusBadge } from './MatchStatusBadge'
import { AutocompleteInput } from './AutocompleteInput'
import type { Jogo, PalpiteJogo, Pais } from '@/types'
import { faseLabel, formatDate, jogoBloqueado, isBrasil } from '@/lib/utils'

interface GameCardProps {
  jogo: Jogo
  palpite: PalpiteJogo | null
  todosJogos: Jogo[]
  paises: Pais[]
  onSave: (jogoId: number, casa: number, fora: number, classificado?: number | null) => Promise<void>
  onSaveMarcadores?: (jogoId: number, marcadores: { nome_jogador: string; quantidade_gols: number }[]) => Promise<void>
  marcadores?: { nome_jogador: string; quantidade_gols: number }[]
  candidatos?: string[]
}

export function GameCard({
  jogo,
  palpite,
  todosJogos,
  paises,
  onSave,
  onSaveMarcadores,
  marcadores = [],
  candidatos = [],
}: GameCardProps) {
  const bloqueado = jogoBloqueado(jogo, todosJogos)
  const brasil = isBrasil(jogo)

  const [casa, setCasa] = useState<number | null>(palpite?.palpite_casa ?? null)
  const [fora, setFora] = useState<number | null>(palpite?.palpite_fora ?? null)
  const [classificado, setClassificado] = useState<number | null>(
    palpite?.palpite_classificado_id ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [showMarcadores, setShowMarcadores] = useState(false)
  const [marcadoresLocal, setMarcadoresLocal] = useState(
    marcadores.length > 0 ? marcadores : [{ nome_jogador: '', quantidade_gols: 1 }],
  )
  const [savingMarcadores, setSavingMarcadores] = useState(false)

  const status = jogo.finalizado ? 'done' : bloqueado ? 'locked' : 'open'
  const temPalpite = palpite !== null
  const hasResult = jogo.placar_casa !== null && jogo.placar_fora !== null
  const palpiteBaseCasa = palpite?.palpite_casa ?? null
  const palpiteBaseFora = palpite?.palpite_fora ?? null
  const palpiteBaseClassificado = palpite?.palpite_classificado_id ?? null
  const palpiteAlterado =
    casa !== palpiteBaseCasa ||
    fora !== palpiteBaseFora ||
    classificado !== palpiteBaseClassificado
  const podeSalvar =
    casa !== null && fora !== null && (jogo.tipo_fase !== 'mata_mata' || classificado !== null)

  useEffect(() => {
    setCasa(palpite?.palpite_casa ?? null)
    setFora(palpite?.palpite_fora ?? null)
    setClassificado(palpite?.palpite_classificado_id ?? null)
  }, [jogo.id, palpite?.id, palpite?.palpite_casa, palpite?.palpite_fora, palpite?.palpite_classificado_id])

  const handleSave = async () => {
    if (casa === null || fora === null) return
    if (jogo.tipo_fase === 'mata_mata' && !classificado) return
    setSaving(true)
    try {
      await onSave(jogo.id, casa, fora, classificado)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMarcadores = async () => {
    if (!onSaveMarcadores) return
    setSavingMarcadores(true)
    try {
      const valid = marcadoresLocal.filter(
        (m) => m.nome_jogador.trim() && m.quantidade_gols >= 0,
      )
      await onSaveMarcadores(jogo.id, valid)
    } finally {
      setSavingMarcadores(false)
    }
  }

  const rodadaLabel =
    jogo.tipo_fase === 'grupos' && jogo.rodada ? `Rodada ${jogo.rodada}` : null

  return (
    <motion.article
      layout
      className="glass rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <MatchStatusBadge status={status} />
        <div className="text-right">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {faseLabel(jogo)}{rodadaLabel && ` · ${rodadaLabel}`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            {formatDate(jogo.data_jogo)}
          </p>
        </div>
      </div>

      {/* Match row */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Home team */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <CountryFlag pais={jogo.pais_casa} size="md" />
            <span className="font-semibold text-sm truncate">{jogo.pais_casa.nome}</span>
          </div>

          {/* Score inputs */}
          <div className="flex items-center gap-1 shrink-0">
            <ScoreStepper
              value={casa}
              onChange={setCasa}
              disabled={bloqueado}
              readOnly={bloqueado}
              label={`Palpite ${jogo.pais_casa.nome}`}
            />
            <span className="mx-1 text-base font-bold" style={{ color: 'var(--text-muted)' }}>×</span>
            <ScoreStepper
              value={fora}
              onChange={setFora}
              disabled={bloqueado}
              readOnly={bloqueado}
              label={`Palpite ${jogo.pais_fora.nome}`}
            />
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
            <span className="font-semibold text-sm truncate text-right">{jogo.pais_fora.nome}</span>
            <CountryFlag pais={jogo.pais_fora} size="md" />
          </div>
        </div>

        {/* Result (if available) */}
        {hasResult && (
          <div
            className="mt-3 flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Trophy size={12} style={{ color: 'var(--highlight)' }} />
            <span style={{ color: 'var(--text-muted)' }}>
              Resultado: {jogo.placar_casa} × {jogo.placar_fora}
            </span>
            {jogo.teve_prorrogacao && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.06)' }}>
                Prorrogação
              </span>
            )}
            {jogo.foi_para_penaltis && jogo.penaltis_casa !== null && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.06)' }}>
                Pênaltis {jogo.penaltis_casa}×{jogo.penaltis_fora}
              </span>
            )}
          </div>
        )}

        {/* Classificado (knockout) */}
        {jogo.tipo_fase === 'mata_mata' && (
          <div className="mt-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Quem se classifica?
            </label>
            <div className="flex gap-2">
              {[jogo.pais_casa, jogo.pais_fora].map((pais) => (
                <button
                  key={pais.id}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setClassificado(pais.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-150 disabled:opacity-40"
                  style={{
                    background: classificado === pais.id
                      ? 'rgba(53,208,127,0.15)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${classificado === pais.id
                      ? 'rgba(53,208,127,0.4)'
                      : 'rgba(255,255,255,0.08)'}`,
                    color: classificado === pais.id ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  <CountryFlag pais={pais} size="sm" />
                  {pais.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Points (if has prediction) */}
        {temPalpite && palpite && (
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {palpite.pontuacao_total > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(53,208,127,0.3)' }}
              >
                +{palpite.pontuacao_total} pts
              </span>
            )}
          </div>
        )}

        {/* Save button */}
        {!bloqueado && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !podeSalvar || (temPalpite && !palpiteAlterado)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40"
            style={{
              background: temPalpite && !palpiteAlterado ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
              color: temPalpite && !palpiteAlterado ? 'var(--text-muted)' : '#070A12',
            }}
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving
              ? 'Salvando…'
              : !temPalpite
                ? 'Salvar palpite'
                : palpiteAlterado
                  ? 'Atualizar palpite'
                  : 'Palpite salvo'}
          </button>
        )}

        {/* Brazil scorers section */}
        {brasil && temPalpite && onSaveMarcadores && (
          <div className="mt-3" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setShowMarcadores((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium w-full"
              style={{ color: 'var(--highlight)' }}
            >
              <span>Marcadores do Brasil (bônus)</span>
              <ChevronDown
                size={16}
                className="ml-auto transition-transform duration-200"
                style={{ transform: showMarcadores ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            <AnimatePresence>
              {showMarcadores && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-2">
                    {marcadoresLocal.map((m, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <AutocompleteInput
                          value={m.nome_jogador}
                          onChange={(val) => {
                            const next = [...marcadoresLocal]
                            next[i] = { ...next[i], nome_jogador: val }
                            setMarcadoresLocal(next)
                          }}
                          options={candidatos}
                          disabled={bloqueado}
                          placeholder="Nome do jogador"
                        />
                        <input
                          type="number"
                          min={0}
                          value={m.quantidade_gols}
                          onChange={(e) => {
                            const next = [...marcadoresLocal]
                            next[i] = { ...next[i], quantidade_gols: parseInt(e.target.value) || 0 }
                            setMarcadoresLocal(next)
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
                          onClick={() =>
                            setMarcadoresLocal((prev) => [
                              ...prev,
                              { nome_jogador: '', quantidade_gols: 1 },
                            ])
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
                        onClick={handleSaveMarcadores}
                        disabled={bloqueado || savingMarcadores}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
                        style={{
                          background: 'var(--highlight-dim)',
                          border: '1px solid rgba(246,198,91,0.3)',
                          color: 'var(--highlight)',
                        }}
                      >
                        {savingMarcadores ? 'Salvando…' : 'Salvar marcadores'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {brasil && !temPalpite && (
          <p className="mt-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Salve o palpite para registrar marcadores.
          </p>
        )}
      </div>
    </motion.article>
  )
}
