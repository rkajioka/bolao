import { useEffect, useMemo, useState } from 'react'
import { SelectInput } from '@/components/SelectInput'
import type { Jogo } from '@/types'
import { OfficialGameResultCard } from '@/features/official-results/OfficialGameResultCard'
import {
  agruparJogosPorGrupo,
  chaveGrupoSecao,
  dataChaveLocal,
  labelDataCabecalho,
  labelDataFiltro,
  ordenarChavesGrupo,
  tituloSecaoGrupo,
} from '@/features/official-results/officialResultUtils'

interface OfficialResultsPanelProps {
  jogos: Jogo[]
  readOnly?: boolean
  showFlags?: boolean
  showDateFilter?: boolean
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
  showGrupoFilter = false,
  groupByGrupo = false,
  title,
  emptyMessage = 'Nenhum jogo nesta lista.',
  onSaved,
  onError,
}: OfficialResultsPanelProps) {
  const [filtroData, setFiltroData] = useState<string>('todas')
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

  const grupos = useMemo(
    () => ordenarChavesGrupo([...new Set(jogos.map((jogo) => chaveGrupoSecao(jogo)))]),
    [jogos],
  )

  useEffect(() => {
    if (filtroGrupo !== 'todos' && !grupos.includes(filtroGrupo)) {
      setFiltroGrupo('todos')
    }
  }, [filtroGrupo, grupos])

  const jogosFiltrados = useMemo(() => {
    let lista = jogos
    if (showGrupoFilter && filtroGrupo !== 'todos') {
      lista = lista.filter((jogo) => chaveGrupoSecao(jogo) === filtroGrupo)
    }
    if (showDateFilter && filtroData !== 'todas') {
      lista = lista.filter((jogo) => dataChaveLocal(jogo.data_jogo) === filtroData)
    }
    return lista
  }, [jogos, filtroData, filtroGrupo, showDateFilter, showGrupoFilter])

  const exibirSecoesGrupo = groupByGrupo && (!showGrupoFilter || filtroGrupo === 'todos')

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

  const opcoesFiltroGrupo = useMemo(
    () => [
      { value: 'todos', label: 'Todos os grupos' },
      ...grupos.map((grupo) => ({ value: grupo, label: tituloSecaoGrupo(grupo) })),
    ],
    [grupos],
  )

  const exibirFiltros =
    (showDateFilter && datas.length > 0) || (showGrupoFilter && grupos.length > 0)

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
              {showGrupoFilter && grupos.length > 0 && (
                <div className="w-full sm:w-48">
                  <SelectInput
                    value={filtroGrupo}
                    onChange={(value) => setFiltroGrupo(value)}
                    options={opcoesFiltroGrupo}
                    placeholder="Grupo"
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
