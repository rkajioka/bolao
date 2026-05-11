import type { Jogo } from '@/types'

export function dataChaveLocal(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function labelDataCabecalho(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function labelDataFiltro(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  if (!y || !m || !d) return yyyyMmDd
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const MS_2H = 2 * 60 * 60 * 1000

export function momentoLiberacaoFinalizacaoOficial(dataJogo: string): number {
  const inicio = new Date(dataJogo).getTime()
  return Number.isFinite(inicio) ? inicio + MS_2H : Number.NaN
}

export function podeFinalizarResultadoOficial(dataJogo: string, agora = Date.now()): boolean {
  const liberacao = momentoLiberacaoFinalizacaoOficial(dataJogo)
  return Number.isFinite(liberacao) && agora >= liberacao
}

export function chaveGrupoSecao(jogo: { tipo_fase: string; grupo: string | null }): string {
  if (jogo.tipo_fase === 'grupos') {
    return (jogo.grupo || '?').toUpperCase()
  }
  return 'MATA-MATA'
}

export function tituloSecaoGrupo(chave: string): string {
  return chave === 'MATA-MATA' ? 'Mata-mata' : `Grupo ${chave}`
}

export function ordenarChavesGrupo(chaves: string[]): string[] {
  return [...chaves].sort((a, b) => {
    if (a === 'MATA-MATA' && b !== 'MATA-MATA') return 1
    if (b === 'MATA-MATA' && a !== 'MATA-MATA') return -1
    return a.localeCompare(b)
  })
}

export function agruparJogosPorGrupo(jogos: Jogo[]): [string, Jogo[]][] {
  const mapa = new Map<string, Jogo[]>()
  for (const jogo of jogos) {
    const chave = chaveGrupoSecao(jogo)
    const lista = mapa.get(chave) ?? []
    lista.push(jogo)
    mapa.set(chave, lista)
  }
  return ordenarChavesGrupo([...mapa.keys()]).map((chave) => [chave, mapa.get(chave) ?? []])
}
