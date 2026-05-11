import { useEffect, useMemo, useState } from 'react'
import { CountryFlag } from '@/components/CountryFlag'
import { faseLabel, formatDate } from '@/lib/utils'
import {
  momentoLiberacaoFinalizacaoOficial,
  podeFinalizarResultadoOficial,
} from '@/features/official-results/officialResultUtils'
import { gamesService, type UpdateResultadoPayload } from '@/services/games.service'
import type { Jogo } from '@/types'

interface OfficialGameResultCardProps {
  jogo: Jogo
  readOnly?: boolean
  showFlags?: boolean
  onSaved?: () => void | Promise<void>
  onError?: (message: string) => void
}

function inferClassificado(
  jogo: Jogo,
  placarCasa: number,
  placarFora: number,
  foiParaPenaltis: boolean,
  penaltisCasa: number | null,
  penaltisFora: number | null,
): number | null {
  if (placarCasa > placarFora) return jogo.pais_casa_id
  if (placarFora > placarCasa) return jogo.pais_fora_id
  if (foiParaPenaltis && penaltisCasa !== null && penaltisFora !== null) {
    if (penaltisCasa > penaltisFora) return jogo.pais_casa_id
    if (penaltisFora > penaltisCasa) return jogo.pais_fora_id
  }
  return null
}

export function OfficialGameResultCard({
  jogo,
  readOnly = false,
  showFlags = false,
  onSaved,
  onError,
}: OfficialGameResultCardProps) {
  const [placarCasa, setPlacarCasa] = useState(jogo.placar_casa ?? 0)
  const [placarFora, setPlacarFora] = useState(jogo.placar_fora ?? 0)
  const [classificadoId, setClassificadoId] = useState<number | null>(jogo.classificado_id)
  const [foiParaPenaltis, setFoiParaPenaltis] = useState(jogo.foi_para_penaltis)
  const [penaltisCasa, setPenaltisCasa] = useState<number | null>(jogo.penaltis_casa)
  const [penaltisFora, setPenaltisFora] = useState<number | null>(jogo.penaltis_fora)
  const [saving, setSaving] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  const isMataMata = jogo.tipo_fase === 'mata_mata'
  const empatado = placarCasa === placarFora

  useEffect(() => {
    if (readOnly || jogo.finalizado) return
    const id = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [readOnly, jogo.finalizado, jogo.id])

  const podeFinalizar = podeFinalizarResultadoOficial(jogo.data_jogo, agora)
  const liberacaoFinalizacao = momentoLiberacaoFinalizacaoOficial(jogo.data_jogo)

  useEffect(() => {
    setPlacarCasa(jogo.placar_casa ?? 0)
    setPlacarFora(jogo.placar_fora ?? 0)
    setClassificadoId(jogo.classificado_id)
    setFoiParaPenaltis(jogo.foi_para_penaltis)
    setPenaltisCasa(jogo.penaltis_casa)
    setPenaltisFora(jogo.penaltis_fora)
  }, [
    jogo.id,
    jogo.placar_casa,
    jogo.placar_fora,
    jogo.classificado_id,
    jogo.foi_para_penaltis,
    jogo.penaltis_casa,
    jogo.penaltis_fora,
  ])

  const classificadoInferido = useMemo(
    () => inferClassificado(jogo, placarCasa, placarFora, foiParaPenaltis, penaltisCasa, penaltisFora),
    [jogo, placarCasa, placarFora, foiParaPenaltis, penaltisCasa, penaltisFora],
  )

  useEffect(() => {
    if (!isMataMata || readOnly || jogo.finalizado) return
    if (classificadoInferido !== null) {
      setClassificadoId(classificadoInferido)
    }
  }, [classificadoInferido, isMataMata, readOnly, jogo.finalizado])

  const handleSalvar = async () => {
    if (readOnly || jogo.finalizado) return
    if (!podeFinalizar) {
      onError?.('Só é possível finalizar a partida 2 horas após o início do jogo.')
      return
    }

    const classificadoFinal = isMataMata
      ? classificadoId ?? classificadoInferido
      : null

    if (isMataMata && classificadoFinal === null) {
      onError?.('Informe o classificado do mata-mata antes de finalizar.')
      return
    }

    if (isMataMata && empatado && foiParaPenaltis) {
      if (penaltisCasa === null || penaltisFora === null) {
        onError?.('Informe o placar dos pênaltis.')
        return
      }
    }

    const payload: UpdateResultadoPayload = {
      placar_casa: placarCasa,
      placar_fora: placarFora,
    }

    if (isMataMata) {
      payload.classificado_id = classificadoFinal
      if (empatado) {
        payload.foi_para_penaltis = foiParaPenaltis
        if (foiParaPenaltis) {
          payload.penaltis_casa = penaltisCasa
          payload.penaltis_fora = penaltisFora
        }
      }
    }

    setSaving(true)
    try {
      await gamesService.updateResult(jogo.id, payload)
      await gamesService.finalize(jogo.id)
      await onSaved?.()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Erro ao salvar resultado')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'var(--text)',
  } as const

  return (
    <div
      className="rounded-xl p-3 space-y-3"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            {faseLabel(jogo)} · {formatDate(jogo.data_jogo)}
          </p>
          <p className="font-semibold text-sm mt-0.5 truncate">
            {jogo.pais_casa.nome} vs {jogo.pais_fora.nome}
          </p>
        </div>
        {jogo.finalizado && (
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shrink-0"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            Finalizado
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-muted)' }}>
            {showFlags ? (
              <span className="inline-flex items-center gap-1.5">
                <CountryFlag pais={jogo.pais_casa} size="sm" />
                {jogo.pais_casa.nome}
              </span>
            ) : (
              jogo.pais_casa.nome
            )}
          </p>
          {readOnly || jogo.finalizado ? (
            <p className="text-2xl font-bold">{placarCasa}</p>
          ) : (
            <input
              type="number"
              min={0}
              aria-label={`Placar ${jogo.pais_casa.nome}`}
              value={placarCasa}
              onChange={(e) => setPlacarCasa(parseInt(e.target.value, 10) || 0)}
              className="w-full text-center text-2xl font-bold py-2 rounded-xl outline-none"
              style={inputStyle}
            />
          )}
        </div>

        <span className="pb-2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
          ×
        </span>

        <div className="space-y-1 min-w-0 text-right">
          <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-muted)' }}>
            {showFlags ? (
              <span className="inline-flex items-center gap-1.5 justify-end">
                {jogo.pais_fora.nome}
                <CountryFlag pais={jogo.pais_fora} size="sm" />
              </span>
            ) : (
              jogo.pais_fora.nome
            )}
          </p>
          {readOnly || jogo.finalizado ? (
            <p className="text-2xl font-bold">{placarFora}</p>
          ) : (
            <input
              type="number"
              min={0}
              aria-label={`Placar ${jogo.pais_fora.nome}`}
              value={placarFora}
              onChange={(e) => setPlacarFora(parseInt(e.target.value, 10) || 0)}
              className="w-full text-center text-2xl font-bold py-2 rounded-xl outline-none"
              style={inputStyle}
            />
          )}
        </div>
      </div>

      {isMataMata && empatado && !readOnly && !jogo.finalizado && (
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={foiParaPenaltis}
            onChange={(e) => {
              setFoiParaPenaltis(e.target.checked)
              if (!e.target.checked) {
                setPenaltisCasa(null)
                setPenaltisFora(null)
              }
            }}
          />
          Decidido nos pênaltis
        </label>
      )}

      {isMataMata && empatado && foiParaPenaltis && !readOnly && !jogo.finalizado && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            aria-label={`Pênaltis ${jogo.pais_casa.nome}`}
            value={penaltisCasa ?? ''}
            onChange={(e) =>
              setPenaltisCasa(e.target.value === '' ? null : parseInt(e.target.value, 10) || 0)
            }
            placeholder="Pên. casa"
            className="px-3 py-2 rounded-xl text-sm outline-none"
            style={inputStyle}
          />
          <input
            type="number"
            min={0}
            aria-label={`Pênaltis ${jogo.pais_fora.nome}`}
            value={penaltisFora ?? ''}
            onChange={(e) =>
              setPenaltisFora(e.target.value === '' ? null : parseInt(e.target.value, 10) || 0)
            }
            placeholder="Pên. fora"
            className="px-3 py-2 rounded-xl text-sm outline-none"
            style={inputStyle}
          />
        </div>
      )}

      {isMataMata && empatado && !foiParaPenaltis && !readOnly && !jogo.finalizado && (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Classificado
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[jogo.pais_casa, jogo.pais_fora].map((pais) => (
              <button
                key={pais.id}
                type="button"
                onClick={() => setClassificadoId(pais.id)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background:
                    classificadoId === pais.id ? 'var(--accent-dim)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${
                    classificadoId === pais.id ? 'rgba(53,208,127,0.35)' : 'rgba(255,255,255,0.10)'
                  }`,
                  color: classificadoId === pais.id ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {pais.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {!readOnly && !jogo.finalizado && (
        <div className="space-y-2">
          {!podeFinalizar && Number.isFinite(liberacaoFinalizacao) && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Finalização liberada às{' '}
              {new Date(liberacaoFinalizacao).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving || !podeFinalizar}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#070A12' }}
          >
            {saving ? 'Salvando…' : 'Salvar e finalizar'}
          </button>
        </div>
      )}
    </div>
  )
}
