import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { SelectInput } from '@/components/SelectInput'
import { BrazilOfficialScorers } from '@/features/official-results/BrazilOfficialScorers'
import {
  dataChaveLocal,
  labelDataFiltro,
} from '@/features/official-results/officialResultUtils'
import type { Jogo, Pais } from '@/types'
import { FASES_MATA_MATA_OPTIONS } from '@/lib/faseMataLabels'
import { compareJogosPorDataJogoAsc, faseLabel, isBrasil } from '@/lib/utils'
import { gamesService } from '@/services/games.service'
import { adminService } from '@/services/admin.service'

interface AdminGamesProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

const GRUPOS_DISPONIVEIS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const

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

  const [finalizadosAbertos, setFinalizadosAbertos] = useState(false)
  const [novoCandidato, setNovoCandidato] = useState('')
  const [buscaCandidatos, setBuscaCandidatos] = useState('')
  const [filtroCandidatos, setFiltroCandidatos] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [candidatoEditandoId, setCandidatoEditandoId] = useState<number | null>(null)
  const [candidatoNomeDraft, setCandidatoNomeDraft] = useState('')
  const [novoJogo, setNovoJogo] = useState({
    tipo_fase: 'grupos' as 'grupos' | 'mata_mata',
    grupo: 'A',
    rodada: 3,
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
  const faseMataOptions = FASES_MATA_MATA_OPTIONS
  const rodadaOptions = [
    { value: '1', label: 'Rodada 1' },
    { value: '2', label: 'Rodada 2' },
    { value: '3', label: 'Rodada 3' },
  ]
  const paisOptions = useMemo(
    () => paisesDisponiveis.map((p: Pais) => ({ value: String(p.id), label: p.nome })),
    [paisesDisponiveis],
  )

  const candidatosFiltrados = useMemo(() => {
    let list = candidatosAdmin
    if (filtroCandidatos === 'ativos') list = list.filter((c) => c.ativo)
    if (filtroCandidatos === 'inativos') list = list.filter((c) => !c.ativo)
    const q = buscaCandidatos.trim().toLowerCase()
    if (q) list = list.filter((c) => c.nome.toLowerCase().includes(q))
    return list
  }, [candidatosAdmin, filtroCandidatos, buscaCandidatos])

  const jogosOrdenados = useMemo(() => [...jogos].sort(compareJogosPorDataJogoAsc), [jogos])

  const jogosFinalizados = useMemo(
    () => jogosOrdenados.filter((j) => j.finalizado),
    [jogosOrdenados],
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

  const atualizarCandidato = async (id: number, payload: { nome?: string; ativo?: boolean }) => {
    try {
      await gamesService.updateCandidate(id, payload)
      await queryClient.invalidateQueries({ queryKey: ['marcadores', 'candidatos', 'admin'] })
      success('Candidato atualizado')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao atualizar candidato')
    }
  }

  const salvarEdicaoNomeCandidato = async () => {
    if (candidatoEditandoId == null) return
    const nome = candidatoNomeDraft.trim()
    if (!nome) {
      error('Informe o nome do jogador')
      return
    }
    try {
      await gamesService.updateCandidate(candidatoEditandoId, { nome })
      await queryClient.invalidateQueries({ queryKey: ['marcadores', 'candidatos', 'admin'] })
      success('Nome do jogador atualizado')
      setCandidatoEditandoId(null)
      setCandidatoNomeDraft('')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao atualizar nome')
    }
  }

  const cancelarEdicaoCandidato = () => {
    setCandidatoEditandoId(null)
    setCandidatoNomeDraft('')
  }

  if (isLoading) return (
    <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
      Carregando…
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Novo jogo — z-index acima do bloco seguinte para o dropdown dos selects não ficar coberto */}
      <div className="glass rounded-2xl p-4 space-y-3 relative z-20 overflow-visible">
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
              onChange={(value) => setNovoJogo((old) => ({ ...old, rodada: Number(value) || 3 }))}
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
      <div className="glass rounded-2xl p-4 space-y-3 relative z-10">
        <div>
          <p className="text-sm font-semibold">Candidatos a marcadores do Brasil</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Busque, filtre e edite jogadores já cadastrados. Desativar remove o nome das listas dos usuários (não apaga o
            registro).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={novoCandidato}
            onChange={(e) => setNovoCandidato(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criarCandidato()}
            placeholder="Novo jogador — nome completo"
            aria-label="Nome do candidato a marcador"
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
          />
          <button
            type="button"
            onClick={criarCandidato}
            className="px-4 py-2 rounded-xl text-sm font-semibold shrink-0"
            style={{ background: 'rgba(53,208,127,0.16)', border: '1px solid rgba(53,208,127,0.35)', color: 'var(--accent)' }}
          >
            Adicionar
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Cadastrados ({candidatosAdmin.length})
            {candidatosFiltrados.length !== candidatosAdmin.length && (
              <span> — exibindo {candidatosFiltrados.length}</span>
            )}
          </p>
          <input
            type="search"
            value={buscaCandidatos}
            onChange={(e) => setBuscaCandidatos(e.target.value)}
            placeholder="Buscar por nome…"
            aria-label="Buscar candidatos"
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
          />
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'todos' as const, label: 'Todos' },
                { key: 'ativos' as const, label: 'Só ativos' },
                { key: 'inativos' as const, label: 'Só inativos' },
              ]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFiltroCandidatos(key)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                style={{
                  background: filtroCandidatos === key ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${filtroCandidatos === key ? 'var(--accent)' : 'rgba(255,255,255,0.10)'}`,
                  color: filtroCandidatos === key ? '#070A12' : 'var(--text-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl overflow-y-auto max-h-[min(22rem,50vh)] space-y-2 pr-1"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {candidatosFiltrados.length === 0 ? (
            <p className="text-sm py-6 px-3 text-center" style={{ color: 'var(--text-muted)' }}>
              {candidatosAdmin.length === 0
                ? 'Nenhum candidato ainda. Use o campo acima para adicionar.'
                : 'Nenhum resultado para essa busca ou filtro.'}
            </p>
          ) : (
            candidatosFiltrados.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 p-3 border-b border-white/5 last:border-b-0"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                {candidatoEditandoId === c.id ? (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      value={candidatoNomeDraft}
                      onChange={(e) => setCandidatoNomeDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && salvarEdicaoNomeCandidato()}
                      aria-label={`Editar nome — id ${c.id}`}
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
                      autoFocus
                    />
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => salvarEdicaoNomeCandidato()}
                        className="px-3 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: 'var(--accent)', color: '#070A12' }}
                      >
                        Salvar nome
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicaoCandidato}
                        className="px-3 py-2 rounded-xl text-xs font-medium"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 flex items-start gap-2">
                      <span
                        className={`text-sm font-medium break-words ${!c.ativo ? 'opacity-60' : ''}`}
                        style={{ color: 'var(--text)' }}
                      >
                        {c.nome}
                      </span>
                      <span
                        className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: c.ativo ? 'rgba(53,208,127,0.15)' : 'rgba(255,255,255,0.08)',
                          color: c.ativo ? 'var(--accent)' : 'var(--text-muted)',
                          border: `1px solid ${c.ativo ? 'rgba(53,208,127,0.35)' : 'rgba(255,255,255,0.10)'}`,
                        }}
                      >
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCandidatoEditandoId(c.id)
                          setCandidatoNomeDraft(c.nome)
                        }}
                        className="text-xs px-3 py-1.5 rounded-xl font-medium"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)' }}
                      >
                        Editar nome
                      </button>
                      <button
                        type="button"
                        onClick={() => atualizarCandidato(c.id, { ativo: !c.ativo })}
                        className="text-xs px-3 py-1.5 rounded-xl font-medium"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
                      >
                        {c.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Finalizados — colapsado */}
      {jogosFinalizados.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setFinalizadosAbertos((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
            style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: 'var(--text)' }}
            aria-expanded={finalizadosAbertos}
          >
            <span className="text-sm font-semibold">
              Jogos finalizados ({jogosFinalizados.length})
            </span>
            <ChevronDown
              size={18}
              className="shrink-0 transition-transform duration-200"
              style={{ transform: finalizadosAbertos ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}
            />
          </button>
          <AnimatePresence initial={false}>
            {finalizadosAbertos && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {jogosFinalizados.map((jogo) => (
                    <div
                      key={jogo.id}
                      className="rounded-xl p-3 space-y-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {labelDataFiltro(dataChaveLocal(jogo.data_jogo))} · {faseLabel(jogo)}
                          </p>
                          <p className="text-sm font-medium truncate">
                            {jogo.pais_casa.nome} {jogo.placar_casa ?? '—'} × {jogo.placar_fora ?? '—'}{' '}
                            {jogo.pais_fora.nome}
                          </p>
                        </div>
                      </div>
                      {isBrasil(jogo) && (
                        <BrazilOfficialScorers
                          jogo={jogo}
                          placarCasa={jogo.placar_casa ?? 0}
                          placarFora={jogo.placar_fora ?? 0}
                          bloqueado={false}
                          onError={(msg) => error(msg)}
                          onSaved={() => success('Marcadores do Brasil salvos')}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
