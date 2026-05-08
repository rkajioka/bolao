import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CountryFlag } from '@/components/CountryFlag'
import { AutocompleteInput } from '@/components/AutocompleteInput'
import { SelectInput } from '@/components/SelectInput'
import type { Jogo, Pais } from '@/types'
import { formatDate, faseLabel } from '@/lib/utils'
import { gamesService } from '@/services/games.service'
import { adminService } from '@/services/admin.service'

interface AdminGamesProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

const GRUPOS_DISPONIVEIS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const

const FASES_MATA_MATA = [
  { value: 'dezesseis_avos', label: '16-avos' },
  { value: 'oitavas', label: 'Oitavas' },
  { value: 'quartas', label: 'Quartas' },
  { value: 'semi', label: 'Semifinal' },
  { value: 'terceiro_lugar', label: '3º lugar' },
  { value: 'final', label: 'Final' },
] as const

export function AdminGames({ success, error }: AdminGamesProps) {
  const queryClient = useQueryClient()

  const { data: jogos = [], isLoading } = useQuery({
    queryKey: ['jogos', 'cronologico'],
    queryFn: () => gamesService.getAll(),
  })
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => adminService.getPaises(),
  })
  const { data: candidatosAdmin = [] } = useQuery({
    queryKey: ['marcadores', 'candidatos', 'admin'],
    queryFn: () => gamesService.getCandidatesAdmin(),
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [result, setResult] = useState({ placar_casa: 0, placar_fora: 0, finalizar: false })
  const [editingMarcadoresId, setEditingMarcadoresId] = useState<number | null>(null)
  const [marcadoresForm, setMarcadoresForm] = useState<Record<number, { nome_jogador: string; quantidade_gols: number }[]>>({})
  const [novoCandidato, setNovoCandidato] = useState('')
  const [novoJogo, setNovoJogo] = useState({
    tipo_fase: 'grupos' as 'grupos' | 'mata_mata',
    grupo: 'A',
    rodada: 1,
    fase_mata: 'oitavas',
    pais_casa_id: '',
    pais_fora_id: '',
    data_jogo: '',
    hora_jogo: '',
  })

  const paisesDisponiveis = useMemo(() => {
    if (novoJogo.tipo_fase === 'grupos') {
      return paises.filter((p) => (p.grupo || '').toUpperCase() === novoJogo.grupo)
    }
    return paises
  }, [novoJogo.tipo_fase, novoJogo.grupo, paises])

  const tipoFaseOptions = [
    { value: 'grupos', label: 'Fase de grupos' },
    { value: 'mata_mata', label: 'Mata-mata' },
  ]
  const grupoOptions = GRUPOS_DISPONIVEIS.map((g) => ({ value: g, label: `Grupo ${g}` }))
  const faseMataOptions = FASES_MATA_MATA.map((f) => ({ value: f.value, label: f.label }))
  const rodadaOptions = [
    { value: '1', label: 'Rodada 1' },
    { value: '2', label: 'Rodada 2' },
    { value: '3', label: 'Rodada 3' },
  ]
  const paisOptions = useMemo(
    () => paisesDisponiveis.map((p: Pais) => ({ value: String(p.id), label: p.nome })),
    [paisesDisponiveis],
  )

  const criarJogo = async () => {
    try {
      if (!novoJogo.data_jogo || !novoJogo.hora_jogo) throw new Error('Informe data e horário do jogo')
      if (!novoJogo.pais_casa_id || !novoJogo.pais_fora_id) throw new Error('Selecione os dois países')
      const iso = new Date(`${novoJogo.data_jogo}T${novoJogo.hora_jogo}:00`).toISOString()
      await gamesService.create({
        tipo_fase: novoJogo.tipo_fase,
        grupo: novoJogo.tipo_fase === 'grupos' ? novoJogo.grupo : null,
        rodada: novoJogo.tipo_fase === 'grupos' ? novoJogo.rodada : null,
        fase: novoJogo.tipo_fase === 'grupos'
          ? `Grupo ${novoJogo.grupo} - Rodada ${novoJogo.rodada}`
          : novoJogo.fase_mata,
        pais_casa_id: Number(novoJogo.pais_casa_id),
        pais_fora_id: Number(novoJogo.pais_fora_id),
        data_jogo: iso,
      })
      await queryClient.invalidateQueries({ queryKey: ['jogos'] })
      success('Jogo cadastrado')
      setNovoJogo((old) => ({ ...old, pais_casa_id: '', pais_fora_id: '', data_jogo: '', hora_jogo: '' }))
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao cadastrar jogo')
    }
  }

  const criarCandidato = async () => {
    const nome = novoCandidato.trim()
    if (!nome) return
    try {
      await gamesService.createCandidate(nome)
      await queryClient.invalidateQueries({ queryKey: ['marcadores', 'candidatos', 'admin'] })
      setNovoCandidato('')
      success('Candidato adicionado')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao adicionar candidato')
    }
  }

  const atualizarCandidato = async (id: number, payload: { ativo?: boolean }) => {
    try {
      await gamesService.updateCandidate(id, payload)
      await queryClient.invalidateQueries({ queryKey: ['marcadores', 'candidatos', 'admin'] })
      success('Candidato atualizado')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao atualizar candidato')
    }
  }

  const handleFinalize = async (jogo: Jogo) => {
    if (jogo.finalizado) return
    try {
      await gamesService.updateResult(jogo.id, {
        placar_casa: result.placar_casa,
        placar_fora: result.placar_fora,
      })
      if (result.finalizar) {
        await gamesService.finalize(jogo.id)
      }
      await queryClient.invalidateQueries({ queryKey: ['jogos'] })
      success('Resultado salvo!')
      setEditingId(null)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar resultado')
    }
  }

  const openMarcadores = async (jogoId: number) => {
    try {
      const existentes = await gamesService.getMarcadoresAdmin(jogoId)
      setMarcadoresForm((old) => ({
        ...old,
        [jogoId]: existentes.length ? existentes : [{ nome_jogador: '', quantidade_gols: 1 }],
      }))
    } catch {
      setMarcadoresForm((old) => ({
        ...old,
        [jogoId]: [{ nome_jogador: '', quantidade_gols: 1 }],
      }))
    }
    setEditingMarcadoresId((v) => (v === jogoId ? null : jogoId))
  }

  const salvarMarcadores = async (jogoId: number) => {
    try {
      const linhas = (marcadoresForm[jogoId] || []).filter((x) => x.nome_jogador.trim())
      await gamesService.saveMarcadoresAdmin(jogoId, linhas)
      await gamesService.recalcularMarcadores(jogoId)
      success('Marcadores do Brasil salvos')
      setEditingMarcadoresId(null)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar marcadores')
    }
  }

  if (isLoading) return (
    <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
      Carregando…
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Novo jogo */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold">Cadastro guiado de jogo</p>
        <div className="grid grid-cols-2 gap-2">
          <SelectInput
            value={novoJogo.tipo_fase}
            onChange={(value) =>
              setNovoJogo((old) => ({ ...old, tipo_fase: value as 'grupos' | 'mata_mata', pais_casa_id: '', pais_fora_id: '' }))
            }
            options={tipoFaseOptions}
            placeholder="Tipo de fase"
          />
          {novoJogo.tipo_fase === 'grupos' ? (
            <SelectInput
              value={novoJogo.grupo}
              onChange={(value) =>
                setNovoJogo((old) => ({ ...old, grupo: value, pais_casa_id: '', pais_fora_id: '' }))
              }
              options={grupoOptions}
              placeholder="Grupo"
            />
          ) : (
            <SelectInput
              value={novoJogo.fase_mata}
              onChange={(value) => setNovoJogo((old) => ({ ...old, fase_mata: value }))}
              options={faseMataOptions}
              placeholder="Fase mata-mata"
            />
          )}
          {novoJogo.tipo_fase === 'grupos' ? (
            <SelectInput
              value={String(novoJogo.rodada)}
              onChange={(value) => setNovoJogo((old) => ({ ...old, rodada: Number(value) || 1 }))}
              options={rodadaOptions}
              placeholder="Rodada"
            />
          ) : (
            <div />
          )}
          <input
            type="date"
            aria-label="Data do jogo"
            value={novoJogo.data_jogo}
            onChange={(e) => setNovoJogo((old) => ({ ...old, data_jogo: e.target.value }))}
            className="px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
          />
          <input
            type="time"
            aria-label="Horário do jogo"
            value={novoJogo.hora_jogo}
            onChange={(e) => setNovoJogo((old) => ({ ...old, hora_jogo: e.target.value }))}
            className="px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
          />
          <SelectInput
            value={novoJogo.pais_casa_id}
            onChange={(value) => setNovoJogo((old) => ({ ...old, pais_casa_id: value }))}
            options={paisOptions}
            placeholder="Time A"
          />
          <SelectInput
            value={novoJogo.pais_fora_id}
            onChange={(value) => setNovoJogo((old) => ({ ...old, pais_fora_id: value }))}
            options={paisOptions}
            placeholder="Time B"
          />
        </div>
        <button
          onClick={criarJogo}
          className="w-full py-2.5 rounded-xl text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ background: 'var(--accent)', color: '#070A12' }}
        >
          Cadastrar jogo
        </button>
      </div>

      {/* Candidatos a marcadores */}
      <div className="glass rounded-2xl p-4 space-y-2">
        <p className="text-sm font-semibold">Candidatos a marcadores do Brasil</p>
        <div className="flex gap-2">
          <input
            value={novoCandidato}
            onChange={(e) => setNovoCandidato(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criarCandidato()}
            placeholder="Nome do jogador"
            aria-label="Nome do candidato a marcador"
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
          />
          <button
            onClick={criarCandidato}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(53,208,127,0.16)', border: '1px solid rgba(53,208,127,0.35)', color: 'var(--accent)' }}
          >
            Adicionar
          </button>
        </div>
        <div className="space-y-1.5">
          {candidatosAdmin.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <span className={`flex-1 text-sm ${!c.ativo ? 'opacity-40 line-through' : ''}`}>
                {c.nome}
              </span>
              <button
                onClick={() => atualizarCandidato(c.id, { ativo: !c.ativo })}
                className="text-xs px-3 py-1.5 rounded-xl font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
              >
                {c.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de jogos */}
      {jogos.map((jogo) => (
        <div key={jogo.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {faseLabel(jogo)} · {formatDate(jogo.data_jogo)}
              </p>
              <p className="font-semibold text-sm mt-0.5">
                {jogo.pais_casa.nome} vs {jogo.pais_fora.nome}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {jogo.finalizado && (
                <span
                  className="text-xs px-2 py-1 rounded-full font-semibold"
                  style={{ background: 'var(--highlight-dim)', color: 'var(--highlight)', border: '1px solid rgba(246,198,91,0.3)' }}
                >
                  Finalizado
                </span>
              )}
              {!jogo.finalizado && (
                <button
                  onClick={() => setEditingId(editingId === jogo.id ? null : jogo.id)}
                  aria-expanded={editingId === jogo.id}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
                >
                  {editingId === jogo.id ? 'Fechar' : 'Resultado'}
                </button>
              )}
              {(jogo.pais_casa.sigla === 'BR' || jogo.pais_fora.sigla === 'BR') && jogo.finalizado && (
                <button
                  onClick={() => openMarcadores(jogo.id)}
                  aria-expanded={editingMarcadoresId === jogo.id}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold"
                  style={{ background: 'rgba(246,198,91,0.10)', border: '1px solid rgba(246,198,91,0.3)', color: 'var(--highlight)' }}
                >
                  Marcadores BR
                </button>
              )}
            </div>
          </div>

          {jogo.placar_casa !== null && (
            <p className="text-xs" style={{ color: 'var(--accent)' }}>
              Resultado: {jogo.placar_casa} × {jogo.placar_fora}
            </p>
          )}

          {/* Form de resultado */}
          <AnimatePresence>
            {editingId === jogo.id && !jogo.finalizado && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 space-y-3" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 flex-1">
                      <CountryFlag pais={jogo.pais_casa} size="sm" />
                      <input
                        type="number"
                        min={0}
                        aria-label={`Placar ${jogo.pais_casa.nome}`}
                        value={result.placar_casa}
                        onChange={(e) => setResult((r) => ({ ...r, placar_casa: parseInt(e.target.value) || 0 }))}
                        className="w-16 text-center text-lg font-bold py-2 rounded-xl outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                      />
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>×</span>
                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Placar ${jogo.pais_fora.nome}`}
                        value={result.placar_fora}
                        onChange={(e) => setResult((r) => ({ ...r, placar_fora: parseInt(e.target.value) || 0 }))}
                        className="w-16 text-center text-lg font-bold py-2 rounded-xl outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                      />
                      <CountryFlag pais={jogo.pais_fora} size="sm" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={result.finalizar}
                      onChange={(e) => setResult((r) => ({ ...r, finalizar: e.target.checked }))}
                      className="w-4 h-4 rounded"
                    />
                    <span style={{ color: 'var(--text-muted)' }}>Finalizar jogo (pontos calculados)</span>
                  </label>
                  <button
                    onClick={() => handleFinalize(jogo)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--accent)', color: '#070A12' }}
                  >
                    Salvar resultado
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form de marcadores */}
          <AnimatePresence>
            {editingMarcadoresId === jogo.id && jogo.finalizado && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 space-y-2" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  {(marcadoresForm[jogo.id] || []).map((m, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <AutocompleteInput
                        value={m.nome_jogador}
                        onChange={(val) =>
                          setMarcadoresForm((old) => ({
                            ...old,
                            [jogo.id]: (old[jogo.id] || []).map((x, i) =>
                              i === idx ? { ...x, nome_jogador: val } : x,
                            ),
                          }))
                        }
                        options={candidatosAdmin.filter((c) => c.ativo).map((c) => c.nome)}
                        placeholder="Nome do jogador"
                      />
                      <input
                        type="number"
                        min={0}
                        aria-label="Quantidade de gols"
                        value={m.quantidade_gols}
                        onChange={(e) =>
                          setMarcadoresForm((old) => ({
                            ...old,
                            [jogo.id]: (old[jogo.id] || []).map((x, i) =>
                              i === idx ? { ...x, quantidade_gols: parseInt(e.target.value) || 0 } : x,
                            ),
                          }))
                        }
                        className="w-16 px-2 py-2 rounded-xl text-sm text-center outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setMarcadoresForm((old) => ({
                          ...old,
                          [jogo.id]: [...(old[jogo.id] || []), { nome_jogador: '', quantidade_gols: 1 }],
                        }))
                      }
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
                    >
                      + Adicionar
                    </button>
                    <button
                      onClick={() => salvarMarcadores(jogo.id)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'var(--highlight-dim)', border: '1px solid rgba(246,198,91,0.3)', color: 'var(--highlight)' }}
                    >
                      Salvar marcadores
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
