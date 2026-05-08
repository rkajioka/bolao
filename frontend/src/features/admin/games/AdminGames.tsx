import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { CountryFlag } from '@/components/CountryFlag'
import { AutocompleteInput } from '@/components/AutocompleteInput'
import { SelectInput } from '@/components/SelectInput'
import type { Jogo, Pais } from '@/types'
import { compareJogosPorDataJogoAsc, formatDate, faseLabel } from '@/lib/utils'
import { gamesService } from '@/services/games.service'
import { adminService } from '@/services/admin.service'

type ResultadoEdicao = { placar_casa: number; placar_fora: number }

/** Chave yyyy-mm-dd no fuso local para agrupar / filtrar. */
function dataChaveLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function labelDataCabecalho(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function labelDataFiltro(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  if (!y || !m || !d) return yyyyMmDd
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

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

  const [resultadosEdicao, setResultadosEdicao] = useState<Record<number, ResultadoEdicao>>({})
  const [editingMarcadoresId, setEditingMarcadoresId] = useState<number | null>(null)
  const [finalizadosAbertos, setFinalizadosAbertos] = useState(false)
  const [filtroDataPendentes, setFiltroDataPendentes] = useState<string>('todas')
  const [marcadoresForm, setMarcadoresForm] = useState<Record<number, { nome_jogador: string; quantidade_gols: number }[]>>({})
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

  const candidatosFiltrados = useMemo(() => {
    let list = candidatosAdmin
    if (filtroCandidatos === 'ativos') list = list.filter((c) => c.ativo)
    if (filtroCandidatos === 'inativos') list = list.filter((c) => !c.ativo)
    const q = buscaCandidatos.trim().toLowerCase()
    if (q) list = list.filter((c) => c.nome.toLowerCase().includes(q))
    return list
  }, [candidatosAdmin, filtroCandidatos, buscaCandidatos])

  const jogosOrdenados = useMemo(() => [...jogos].sort(compareJogosPorDataJogoAsc), [jogos])

  const jogosPendentes = useMemo(
    () => jogosOrdenados.filter((j) => !j.finalizado),
    [jogosOrdenados],
  )

  const jogosFinalizados = useMemo(
    () => jogosOrdenados.filter((j) => j.finalizado),
    [jogosOrdenados],
  )

  const datasPendentes = useMemo(() => {
    const s = new Set<string>()
    for (const j of jogosPendentes) s.add(dataChaveLocal(j.data_jogo))
    return [...s].sort()
  }, [jogosPendentes])

  const opcoesFiltroData = useMemo(
    () => [
      { value: 'todas', label: 'Todas as datas' },
      ...datasPendentes.map((d) => ({ value: d, label: labelDataFiltro(d) })),
    ],
    [datasPendentes],
  )

  useEffect(() => {
    setResultadosEdicao((prev) => {
      const next: Record<number, ResultadoEdicao> = { ...prev }
      for (const j of jogos) {
        if (j.finalizado) {
          delete next[j.id]
          continue
        }
        if (next[j.id] === undefined) {
          next[j.id] = {
            placar_casa: j.placar_casa ?? 0,
            placar_fora: j.placar_fora ?? 0,
          }
        }
      }
      for (const id of Object.keys(next)) {
        const n = Number(id)
        if (!jogos.some((j) => j.id === n)) delete next[n]
      }
      return next
    })
  }, [jogos])

  useEffect(() => {
    if (filtroDataPendentes !== 'todas' && !datasPendentes.includes(filtroDataPendentes)) {
      setFiltroDataPendentes('todas')
    }
  }, [filtroDataPendentes, datasPendentes])

  const pendentesFiltrados = useMemo(() => {
    if (filtroDataPendentes === 'todas') return jogosPendentes
    return jogosPendentes.filter((j) => dataChaveLocal(j.data_jogo) === filtroDataPendentes)
  }, [jogosPendentes, filtroDataPendentes])

  const pendentesAgrupadosPorData = useMemo(() => {
    const m = new Map<string, Jogo[]>()
    for (const j of pendentesFiltrados) {
      const k = dataChaveLocal(j.data_jogo)
      const arr = m.get(k) ?? []
      arr.push(j)
      m.set(k, arr)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [pendentesFiltrados])

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

  const handleSalvarResultado = async (jogo: Jogo) => {
    if (jogo.finalizado) return
    const r = resultadosEdicao[jogo.id]
    if (!r) return
    try {
      await gamesService.updateResult(jogo.id, {
        placar_casa: r.placar_casa,
        placar_fora: r.placar_fora,
      })
      await gamesService.finalize(jogo.id)
      await queryClient.invalidateQueries({ queryKey: ['jogos'] })
      success('Jogo finalizado e pontos calculados.')
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

      {/* Resultados — pendentes */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold">
            Lançar resultados
            <span className="font-normal text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
              ({jogosPendentes.length} em aberto)
            </span>
          </p>
          {datasPendentes.length > 0 && (
            <div className="w-full sm:w-56">
              <SelectInput
                value={filtroDataPendentes}
                onChange={(v) => setFiltroDataPendentes(v)}
                options={opcoesFiltroData}
                placeholder="Data"
              />
            </div>
          )}
        </div>

        {pendentesFiltrados.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            {jogosPendentes.length === 0
              ? 'Nenhum jogo pendente de finalização.'
              : 'Nenhum jogo nesta data.'}
          </p>
        ) : (
          <div className="space-y-6">
            {pendentesAgrupadosPorData.map(([dataKey, lista]) => (
              <div key={dataKey} className="space-y-3">
                <h3
                  className="text-xs font-bold uppercase tracking-wider px-0.5"
                  style={{ color: 'var(--accent)' }}
                >
                  {labelDataCabecalho(lista[0].data_jogo)}
                </h3>
                <div className="space-y-3">
                  {lista.map((jogo) => {
                    const r = resultadosEdicao[jogo.id] ?? {
                      placar_casa: jogo.placar_casa ?? 0,
                      placar_fora: jogo.placar_fora ?? 0,
                    }
                    return (
                      <div key={jogo.id} className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                              {faseLabel(jogo)} · {formatDate(jogo.data_jogo)}
                            </p>
                            <p className="font-semibold text-sm mt-0.5 truncate">
                              {jogo.pais_casa.nome} vs {jogo.pais_fora.nome}
                            </p>
                          </div>
                        </div>
                        {jogo.placar_casa !== null && (
                          <p className="text-xs" style={{ color: 'var(--accent)' }}>
                            No servidor: {jogo.placar_casa} × {jogo.placar_fora}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <CountryFlag pais={jogo.pais_casa} size="sm" />
                            <input
                              type="number"
                              min={0}
                              aria-label={`Placar ${jogo.pais_casa.nome}`}
                              value={r.placar_casa}
                              onChange={(e) =>
                                setResultadosEdicao((prev) => ({
                                  ...prev,
                                  [jogo.id]: {
                                    ...r,
                                    placar_casa: parseInt(e.target.value, 10) || 0,
                                  },
                                }))
                              }
                              className="w-16 text-center text-lg font-bold py-2 rounded-xl outline-none shrink-0"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                            />
                          </div>
                          <span style={{ color: 'var(--text-muted)' }}>×</span>
                          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                            <input
                              type="number"
                              min={0}
                              aria-label={`Placar ${jogo.pais_fora.nome}`}
                              value={r.placar_fora}
                              onChange={(e) =>
                                setResultadosEdicao((prev) => ({
                                  ...prev,
                                  [jogo.id]: {
                                    ...r,
                                    placar_fora: parseInt(e.target.value, 10) || 0,
                                  },
                                }))
                              }
                              className="w-16 text-center text-lg font-bold py-2 rounded-xl outline-none shrink-0"
                              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                            />
                            <CountryFlag pais={jogo.pais_fora} size="sm" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSalvarResultado(jogo)}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold"
                          style={{ background: 'var(--accent)', color: '#070A12' }}
                        >
                          Salvar e finalizar
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
                        {(jogo.pais_casa.sigla === 'BR' || jogo.pais_fora.sigla === 'BR') && (
                          <button
                            type="button"
                            onClick={() => openMarcadores(jogo.id)}
                            aria-expanded={editingMarcadoresId === jogo.id}
                            className="text-xs px-3 py-1.5 rounded-xl font-semibold shrink-0"
                            style={{ background: 'rgba(246,198,91,0.10)', border: '1px solid rgba(246,198,91,0.3)', color: 'var(--highlight)' }}
                          >
                            Marcadores BR
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {editingMarcadoresId === jogo.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2 space-y-2" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
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
                                          i === idx ? { ...x, quantidade_gols: parseInt(e.target.value, 10) || 0 } : x,
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
                                  type="button"
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
                                  type="button"
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
