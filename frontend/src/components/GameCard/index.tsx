import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MatchHeader } from './MatchHeader'
import { MatchTeams } from './MatchTeams'
import { MatchResult } from './MatchResult'
import { KnockoutSection } from './KnockoutSection'
import { BrazilScorers } from './BrazilScorers'
import { FinishedMatchSummary } from './FinishedMatchSummary'
import { api } from '@/lib/api'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'
import type { Jogo, MarcadorCandidato, MarcadorPalpite, PalpiteJogo } from '@/types'
import { jogoBloqueado, isBrasil } from '@/lib/utils'

interface GameCardProps {
  jogo: Jogo
  palpite: PalpiteJogo | null
  todosJogos: Jogo[]
  showStatusBadge?: boolean
  onSave: (jogoId: number, casa: number, fora: number, classificado?: number | null) => Promise<void>
  onSaveMarcadores?: (jogoId: number, marcadores: { nome_jogador: string; quantidade_gols: number }[]) => Promise<void>
  candidatos?: MarcadorCandidato[]
  marcadoresBrasilHabilitado?: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function GameCard({
  jogo,
  palpite,
  todosJogos,
  showStatusBadge = false,
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
  const [touched, setTouched] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
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
    setCasa(palpite?.palpite_casa ?? null)
    setFora(palpite?.palpite_fora ?? null)
    setClassificado(palpite?.palpite_classificado_id ?? null)
    setTouched(false)
    setSaveState('idle')
    setSaveError(null)
  }, [jogo.id, palpite?.id, palpite?.palpite_casa, palpite?.palpite_fora, palpite?.palpite_classificado_id])

  const persistPalpite = useCallback(async () => {
    if (bloqueado || !podeSalvar || !palpiteAlterado || !touched) return
    if (casa === null || fora === null) return
    if (jogo.tipo_fase === 'mata_mata' && !classificado) return

    setSaveState('saving')
    setSaveError(null)
    try {
      await onSave(jogo.id, casa, fora, classificado)
      setSaveState('saved')
      setTouched(false)
    } catch (err) {
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar palpite')
    }
  }, [
    bloqueado,
    podeSalvar,
    palpiteAlterado,
    touched,
    casa,
    fora,
    classificado,
    jogo.id,
    jogo.tipo_fase,
    onSave,
  ])

  const debouncedSave = useDebouncedCallback(persistPalpite, 700)

  useEffect(() => {
    if (!touched || bloqueado || !podeSalvar || !palpiteAlterado) return
    debouncedSave()
  }, [touched, bloqueado, podeSalvar, palpiteAlterado, casa, fora, classificado, debouncedSave])

  const handleCasaChange = (value: number | null) => {
    setTouched(true)
    setCasa(value)
  }

  const handleForaChange = (value: number | null) => {
    setTouched(true)
    setFora(value)
  }

  const handleClassificadoChange = (value: number | null) => {
    setTouched(true)
    setClassificado(value)
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

  const saveFeedback =
    saveState === 'saving'
      ? 'Salvando…'
      : saveState === 'saved'
        ? 'Palpite salvo'
        : saveState === 'error'
          ? saveError ?? 'Erro ao salvar'
          : touched && palpiteAlterado
            ? 'Alterações pendentes'
            : null

  const palpiteEmEdicao =
    !jogo.finalizado &&
    !bloqueado &&
    (saveState === 'saving' || (touched && palpiteAlterado))

  const palpiteRegistrado =
    temPalpite ||
    saveState === 'saved' ||
    palpiteEmEdicao

  const palpiteEncerrado = bloqueado && temPalpite

  return (
    <motion.article
      layout
      className="glass rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: saveState === 'saved'
          ? '0 0 0 1px rgba(53,208,127,0.35), 0 0 16px rgba(53,208,127,0.08)'
          : '0 0 0 0px rgba(53,208,127,0)',
      }}
      transition={{ duration: 0.18, boxShadow: { duration: 0.35, ease: 'easeOut' } }}
      aria-label={`Jogo: ${jogo.pais_casa.nome} vs ${jogo.pais_fora.nome}`}
    >
      <MatchHeader
        jogo={jogo}
        todosJogos={todosJogos}
        status={status}
        showStatusBadge={showStatusBadge}
        palpiteRegistrado={palpiteRegistrado}
        palpiteEmEdicao={palpiteEmEdicao}
        palpiteEncerrado={palpiteEncerrado}
      />

      <div className={`px-4 ${jogo.finalizado ? 'py-3' : 'py-4'}`}>
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
              onCasaChange={handleCasaChange}
              onForaChange={handleForaChange}
            />

            <MatchResult jogo={jogo} />

            <KnockoutSection
              jogo={jogo}
              classificado={classificado}
              bloqueado={bloqueado}
              onClassificadoChange={handleClassificadoChange}
            />
          </>
        )}

        {!bloqueado && saveFeedback && (
          <p
            className="mt-2 text-xs text-center"
            aria-live="polite"
            style={{
              color:
                saveState === 'error'
                  ? 'var(--danger)'
                  : saveState === 'saved'
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
            }}
          >
            {saveFeedback}
          </p>
        )}

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
