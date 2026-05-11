import { useEffect, useMemo, useState } from 'react'
import { SelectInput } from '@/components/SelectInput'
import type { Jogo } from '@/types'
import { OfficialGameResultCard } from '@/features/official-results/OfficialGameResultCard'
import {
  agruparJogosPorGrupo,
  chaveFiltroFaseOficial,
  dataChaveLocal,
  gruposDisponiveisParaFiltro,
  labelDataCabecalho,
  labelDataFiltro,
  labelFiltroFaseOficial,
  ordenarChavesFaseOficial,
  tituloSecaoGrupo,
} from '@/features/official-results/officialResultUtils'

interface OfficialResultsPanelProps {
  jogos: Jogo[]
  readOnly?: boolean
  showFlags?: boolean
  showDateFilter?: boolean
  showFaseFilter?: boolean
  showGrupoFilter?: boolean
  groupByGrupo?: boolean
  title?: string
  emptyMessage?: string
  onSaved?: () => void | Promise<void>
  onError?: (message: string) => void
}

export function OfficialResultsPanel({
  jogos,
  readOnly = false,
  showFlags = false,
  showDateFilter = true,
  showFaseFilter = false,
  showGrupoFilter = false,
  groupByGrupo = false,
  title,
  emptyMessage = 'Nenhum jogo nesta lista.',
  onSaved,
  onError,
}: OfficialResultsPanelProps) {
  const [filtroData, setFiltroData] = useState<string>('todas')
  const [filtroFase, setFiltroFase] = useState<string>('todas')
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos')

  const datas = useMemo(() => {
    const s = new Set<string>()
    for (const jogo of jogos) s.add(dataChaveLocal(jogo.data_jogo))
    return [...s].sort()
  }, [jogos])

  useEffect(() => {
    if (filtroData !== 'todas' && !datas.includes(filtroData)) {
      setFiltroData('todas')
    }
  }, [filtroData, datas])

  const fases = useMemo(
    () => ordenarChavesFaseOficial([...new Set(jogos.map((jogo) => chaveFiltroFaseOficial(jogo)))]),
    [jogos],
  )

  const grupos = useMemo(() => gruposDisponiveisParaFiltro(jogos), [jogos])

  useEffect(() => {
    if (filtroFase !== 'todas' && !fases.includes(filtroFase)) {
      setFiltroFase('todas')
    }
  }, [filtroFase, fases])

  useEffect(() => {
    if (filtroGrupo !== 'todos' && !grupos.includes(filtroGrupo)) {
      setFiltroGrupo('todos')
    }
  }, [filtroGrupo, grupos])

  useEffect(() => {
    if (filtroFase !== 'grupos' && filtroGrupo !== 'todos') {
      setFiltroGrupo('todos')
    }
  }, [filtroFase, filtroGrupo])

  const exibirFiltroGrupo = showGrupoFilter && filtroFase === 'grupos' && grupos.length > 0

  const jogosFiltrados = useMemo(() => {
    let lista = jogos
    if (showFaseFilter && filtroFase !== 'todas') {
      lista = lista.filter((jogo) => chaveFiltroFaseOficial(jogo) === filtroFase)
    }
    if (exibirFiltroGrupo && filtroGrupo !== 'todos') {
      lista = lista.filter(
        (jogo) => jogo.tipo_fase === 'grupos' && (jogo.grupo || '').toUpperCase() === filtroGrupo,
      )
    }
    if (showDateFilter && filtroData !== 'todas') {
      lista = lista.filter((jogo) => dataChaveLocal(jogo.data_jogo) === filtroData)
    }
    return lista
  }, [
    jogos,
    filtroData,
    filtroFase,
    filtroGrupo,
    showDateFilter,
    showFaseFilter,
    exibirFiltroGrupo,
  ])

  const exibirSecoesGrupo =
    groupByGrupo &&
    (filtroFase === 'todas' || filtroFase === 'grupos') &&
    (!exibirFiltroGrupo || filtroGrupo === 'todos')

  const jogosPorData = useMemo(() => {
    const grupos = new Map<string, Jogo[]>()
    for (const jogo of jogosFiltrados) {
      const chave = dataChaveLocal(jogo.data_jogo)
      const lista = grupos.get(chave) ?? []
      lista.push(jogo)
      grupos.set(chave, lista)
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [jogosFiltrados])

  const opcoesFiltroData = useMemo(
    () => [
      { value: 'todas', label: 'Todas as datas' },
      ...datas.map((data) => ({ value: data, label: labelDataFiltro(data) })),
    ],
    [datas],
  )

  const opcoesFiltroFase = useMemo(
    () => [
      { value: 'todas', label: 'Todas as fases' },
      ...fases.map((fase) => ({ value: fase, label: labelFiltroFaseOficial(fase) })),
    ],
    [fases],
  )

  const opcoesFiltroGrupo = useMemo(
    () => [
      { value: 'todos', label: 'Todos os grupos' },
      ...grupos.map((grupo) => ({ value: grupo, label: tituloSecaoGrupo(grupo) })),
    ],
    [grupos],
  )

  const exibirFiltros =
    (showFaseFilter && fases.length > 0) ||
    exibirFiltroGrupo ||
    (showDateFilter && datas.length > 0)

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      {(title || exibirFiltros) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {title ? (
            <p className="text-sm font-semibold">{title}</p>
          ) : (
            <div />
          )}
          {exibirFiltros && (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              {showFaseFilter && fases.length > 0 && (
                <div className="w-full sm:w-48">
                  <SelectInput
                    value={filtroFase}
                    onChange={(value) => setFiltroFase(value)}
                    options={opcoesFiltroFase}
                    placeholder="Fase"
                  />
                </div>
              )}
              {exibirFiltroGrupo && (
                <div className="w-full sm:w-48">
                  <SelectInput
                    value={filtroGrupo}
                    onChange={(value) => setFiltroGrupo(value)}
                    options={opcoesFiltroGrupo}
                    placeholder="Grupo"
                  />
                </div>
              )}
              {showDateFilter && datas.length > 0 && (
                <div className="w-full sm:w-48">
                  <SelectInput
                    value={filtroData}
                    onChange={(value) => setFiltroData(value)}
                    options={opcoesFiltroData}
                    placeholder="Data"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {jogosFiltrados.length === 0 ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-5">
          {jogosPorData.map(([dataKey, lista]) => (
            <div key={dataKey} className="space-y-3">
              <h3
                className="text-xs font-bold uppercase tracking-wider px-0.5"
                style={{ color: 'var(--accent)' }}
              >
                {labelDataCabecalho(lista[0].data_jogo)}
              </h3>
              {exibirSecoesGrupo ? (
                <div className="space-y-4">
                  {agruparJogosPorGrupo(lista).map(([grupo, jogosGrupo]) => (
                    <div key={`${dataKey}-${grupo}`} className="space-y-2">
                      <h4
                        className="text-[11px] font-semibold uppercase tracking-wide px-0.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {tituloSecaoGrupo(grupo)}
                      </h4>
                      <div className="space-y-3">
                        {jogosGrupo.map((jogo) => (
                          <OfficialGameResultCard
                            key={jogo.id}
                            jogo={jogo}
                            readOnly={readOnly || jogo.finalizado}
                            showFlags={showFlags}
                            onSaved={onSaved}
                            onError={onError}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {lista.map((jogo) => (
                    <OfficialGameResultCard
                      key={jogo.id}
                      jogo={jogo}
                      readOnly={readOnly || jogo.finalizado}
                      showFlags={showFlags}
                      onSaved={onSaved}
                      onError={onError}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
