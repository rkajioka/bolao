import { labelFaseMataPorSlug, normalizeFaseSlug } from '@/lib/utils'
import type { Jogo } from '@/types'

const ORDEM_FASES_MATA = [
  'dezesseis_avos',
  'oitavas',
  'quartas',
  'semi',
  'terceiro_lugar',
  'final',
] as const

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

export function chaveFiltroFaseOficial(jogo: Jogo): string {
  if (jogo.tipo_fase === 'grupos') return 'grupos'
  const slug = normalizeFaseSlug(jogo.fase)
  if (slug) return `mata:${slug}`
  const raw = jogo.fase.trim().toLowerCase().replace(/\s+/g, '_')
  return `mata:raw:${raw}`
}

export function labelFiltroFaseOficial(chave: string): string {
  if (chave === 'grupos') return 'Fase de grupos'
  if (!chave.startsWith('mata:')) return chave
  const slug = chave.slice(5)
  if (slug.startsWith('raw:')) return slug.slice(4).replace(/_/g, ' ')
  return labelFaseMataPorSlug(slug)
}

export function ordenarChavesFaseOficial(chaves: string[]): string[] {
  const ordem = (chave: string) => {
    if (chave === 'grupos') return -1
    if (!chave.startsWith('mata:')) return 1_000
    const slug = chave.slice(5)
    const idx = ORDEM_FASES_MATA.indexOf(slug as (typeof ORDEM_FASES_MATA)[number])
    return idx === -1 ? 999 : idx
  }
  return [...chaves].sort((a, b) => {
    const diff = ordem(a) - ordem(b)
    return diff !== 0 ? diff : a.localeCompare(b)
  })
}

export function gruposDisponiveisParaFiltro(jogos: Jogo[]): string[] {
  const grupos = new Set<string>()
  for (const jogo of jogos) {
    if (jogo.tipo_fase === 'grupos' && jogo.grupo) {
      grupos.add(jogo.grupo.toUpperCase())
    }
  }
  return ordenarChavesGrupo([...grupos])
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
