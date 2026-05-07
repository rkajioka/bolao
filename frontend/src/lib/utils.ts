import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Jogo } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function imgUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return url.startsWith('/') ? url : `/${url}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FASE_MATA_SLUGS = new Set([
  'dezesseis_avos',
  'oitavas',
  'quartas',
  'semi',
  'terceiro_lugar',
  'final',
])

const FASE_MATA_LABELS: Record<string, string> = {
  dezesseis_avos: 'Dezesseis avos',
  oitavas: 'Oitavas de final',
  quartas: 'Quartas de final',
  semi: 'Semifinal',
  terceiro_lugar: '3º lugar',
  final: 'Final',
}

function normalizeFaseSlug(fase: string): string | null {
  const t = fase.trim().toLowerCase().replace(/\s+/g, '_')
  const aliases: Record<string, string> = {
    semifinal: 'semi',
    semi_final: 'semi',
    oitavas_de_final: 'oitavas',
  }
  const x = aliases[t] || t
  return FASE_MATA_SLUGS.has(x) ? x : null
}

export function faseLabel(jogo: Jogo): string {
  if (jogo.tipo_fase === 'mata_mata') {
    const slug = normalizeFaseSlug(jogo.fase)
    return slug ? FASE_MATA_LABELS[slug] || jogo.fase : jogo.fase
  }
  return jogo.fase
}

export function isBrasil(jogo: Jogo): boolean {
  return jogo.pais_casa?.sigla === 'BR' || jogo.pais_fora?.sigla === 'BR'
}

export function primeiroInicioGrupoPorRodada(jogos: Jogo[], rodada: number): number | null {
  const ts = jogos
    .filter((j) => j.tipo_fase === 'grupos' && Number(j.rodada) === Number(rodada))
    .map((j) => new Date(j.data_jogo).getTime())
    .filter(Number.isFinite)
  return ts.length ? Math.min(...ts) : null
}

export function primeiroInicioMataPorFase(jogos: Jogo[], slug: string): number | null {
  const ts = jogos
    .filter((j) => j.tipo_fase === 'mata_mata' && normalizeFaseSlug(j.fase) === slug)
    .map((j) => new Date(j.data_jogo).getTime())
    .filter(Number.isFinite)
  return ts.length ? Math.min(...ts) : null
}

export function momentoFimEdicao(jogo: Jogo, todosJogos: Jogo[]): number {
  const MS_1H = 3_600_000
  const todos = todosJogos.length ? todosJogos : [jogo]

  if (jogo.tipo_fase === 'grupos' && jogo.rodada != null) {
    const p = primeiroInicioGrupoPorRodada(todos, jogo.rodada)
    if (p != null) return p - MS_1H
  }

  if (jogo.tipo_fase === 'mata_mata') {
    const slug = normalizeFaseSlug(jogo.fase)
    if (slug) {
      const p = primeiroInicioMataPorFase(todos, slug)
      if (p != null) return p - MS_1H
    }
  }

  return new Date(jogo.data_jogo).getTime()
}

export function jogoBloqueado(jogo: Jogo, todosJogos: Jogo[]): boolean {
  if (jogo.finalizado) return true
  const lim = momentoFimEdicao(jogo, todosJogos)
  return Number.isFinite(lim) && Date.now() >= lim
}

export function getInitials(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}
