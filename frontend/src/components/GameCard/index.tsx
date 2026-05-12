import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Save, CheckCircle } from 'lucide-react'
import { MatchHeader } from './MatchHeader'
import { MatchTeams } from './MatchTeams'
import { MatchResult } from './MatchResult'
import { KnockoutSection } from './KnockoutSection'
import { BrazilScorers } from './BrazilScorers'
import { FinishedMatchSummary } from './FinishedMatchSummary'
import { api } from '@/lib/api'
import type { Jogo, MarcadorCandidato, MarcadorPalpite, PalpiteJogo } from '@/types'
import { jogoBloqueado, isBrasil } from '@/lib/utils'

interface GameCardProps {
  jogo: Jogo
  palpite: PalpiteJogo | null
  todosJogos: Jogo[]
  onSave: (jogoId: number, casa: number, fora: number, classificado?: number | null) => Promise<void>
  onSaveMarcadores?: (jogoId: number, marcadores: { nome_jogador: string; quantidade_gols: number }[]) => Promise<void>
  candidatos?: MarcadorCandidato[]
  marcadoresBrasilHabilitado?: boolean
}

export function GameCard({
  jogo,
  palpite,
  todosJogos,
  onSave,
  onSaveMarcadores,
  candidatos = [],
  marcadoresBrasilHabilitado = false,
}: GameCardProps) {
  const bloqueado = jogoBloqueado(jogo, todosJogos)
  const brasil = isBrasil(jogo)
  const temPalpite = palpite !== null

  const [casa, setCasa] = useState<number | null>(palpite?.palpite_casa ?? null)
  const [fora, setFora] = useState<number | null>(palpite?.palpite_fora ?? null)
  const [classificado, setClassificado] = useState<number | null>(
    palpite?.palpite_classificado_id ?? null,
  )
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [savingMarcadores, setSavingMarcadores] = useState(false)

  const { data: marcadoresSalvos = [] } = useQuery({
    queryKey: ['marcadores-brasil', 'me', jogo.id],
    queryFn: () => api.get<MarcadorPalpite[]>(`/marcadores-brasil/me/${jogo.id}`),
    enabled: brasil && temPalpite && marcadoresBrasilHabilitado && (jogo.finalizado || !bloqueado),
  })

  const marcadoresParaUi = useMemo(
    () => marcadoresSalvos.map((m) => ({ nome_jogador: m.nome_jogador, quantidade_gols: m.quantidade_gols })),
    [marcadoresSalvos],
  )

  const golsBrasil =
    jogo.pais_casa.sigla === 'BR'
      ? (casa ?? palpite?.palpite_casa ?? 0)
      : (fora ?? palpite?.palpite_fora ?? 0)

  const status = jogo.finalizado ? 'done' : bloqueado ? 'locked' : 'open'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCasa(palpite?.palpite_casa ?? null)
    setFora(palpite?.palpite_fora ?? null)
    setClassificado(palpite?.palpite_classificado_id ?? null)
  }, [jogo.id, palpite?.id, palpite?.palpite_casa, palpite?.palpite_fora, palpite?.palpite_classificado_id])

  const handleSave = async () => {
    if (bloqueado) return
    if (casa === null || fora === null) return
    if (jogo.tipo_fase === 'mata_mata' && !classificado) return
    setSaving(true)
    try {
      await onSave(jogo.id, casa, fora, classificado)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMarcadores = async (marcadoresData: { nome_jogador: string; quantidade_gols: number }[]) => {
    if (bloqueado || !onSaveMarcadores) return
    setSavingMarcadores(true)
    try {
      await onSaveMarcadores(jogo.id, marcadoresData)
    } finally {
      setSavingMarcadores(false)
    }
  }

  return (
    <motion.article
      layout
      className="glass rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: justSaved
          ? '0 0 0 1.5px rgba(53,208,127,0.5), 0 0 20px rgba(53,208,127,0.10)'
          : '0 0 0 0px rgba(53,208,127,0)',
      }}
      transition={{ duration: 0.18, boxShadow: { duration: 0.35, ease: 'easeOut' } }}
      aria-label={`Jogo: ${jogo.pais_casa.nome} vs ${jogo.pais_fora.nome}`}
    >
      <MatchHeader jogo={jogo} todosJogos={todosJogos} status={status} />

      <div className="px-4 py-4">
        {jogo.finalizado ? (
          <FinishedMatchSummary
            jogo={jogo}
            palpite={palpite}
            marcadoresBrasilHabilitado={marcadoresBrasilHabilitado}
            marcadoresSalvos={marcadoresParaUi}
          />
        ) : (
          <>
            <MatchTeams
              jogo={jogo}
              casa={casa}
              fora={fora}
              bloqueado={bloqueado}
              onCasaChange={setCasa}
              onForaChange={setFora}
            />

            <MatchResult jogo={jogo} />

            <KnockoutSection
              jogo={jogo}
              classificado={classificado}
              bloqueado={bloqueado}
              onClassificadoChange={setClassificado}
            />
          </>
        )}

        {/* Botão salvar */}
        {!bloqueado && (
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving || !podeSalvar || (temPalpite && !palpiteAlterado)}
            whileTap={saving || !podeSalvar || (temPalpite && !palpiteAlterado) ? {} : { scale: 0.97 }}
            transition={{ duration: 0.1 }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: justSaved
                ? 'rgba(53,208,127,0.15)'
                : temPalpite && !palpiteAlterado
                  ? 'rgba(255,255,255,0.08)'
                  : 'var(--accent)',
              color: justSaved
                ? 'var(--accent)'
                : temPalpite && !palpiteAlterado
                  ? 'var(--text-muted)'
                  : '#070A12',
              border: justSaved ? '1px solid rgba(53,208,127,0.35)' : 'none',
            }}
            aria-live="polite"
          >
            {saving ? (
              <span
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-label="Salvando"
              />
            ) : justSaved ? (
              <CheckCircle size={14} />
            ) : (
              <Save size={14} />
            )}
            {saving
              ? 'Salvando…'
              : justSaved
                ? 'Palpite salvo!'
                : !temPalpite
                  ? 'Salvar palpite'
                  : palpiteAlterado
                    ? 'Atualizar palpite'
                    : 'Palpite salvo'}
          </motion.button>
        )}

        {/* Marcadores do Brasil */}
        {!jogo.finalizado && brasil && temPalpite && marcadoresBrasilHabilitado && onSaveMarcadores && (
          <BrazilScorers
            marcadores={marcadoresParaUi}
            candidatos={candidatos}
            golsBrasil={golsBrasil}
            bloqueado={bloqueado}
            saving={savingMarcadores}
            onSave={handleSaveMarcadores}
          />
        )}

        {!jogo.finalizado && brasil && marcadoresBrasilHabilitado && !temPalpite && (
          <p className="mt-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Salve o palpite para registrar marcadores.
          </p>
        )}
      </div>
    </motion.article>
  )
}
