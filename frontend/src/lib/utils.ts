import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { FASE_MATA_SLUGS, labelFaseMataPorSlug } from '@/lib/faseMataLabels'
import type { Jogo } from '@/types'

export { labelFaseMataPorSlug }

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MENSAGEM_PODIO_REPETIDO_ESPECIAIS =
  'Campeão, vice-campeão e 3º lugar devem ser seleções de países distintos'

export function mensagemPodioRepetidoEspeciais(
  campeaoId?: string | number | null,
  viceCampeaoId?: string | number | null,
  terceiroLugarId?: string | number | null,
): string | null {
  const ids = [campeaoId, viceCampeaoId, terceiroLugarId]
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
  if (new Set(ids).size !== ids.length) {
    return MENSAGEM_PODIO_REPETIDO_ESPECIAIS
  }
  return null
}

export function imgUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return ''
  }
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

const FASE_MATA_SLUG_SET = new Set<string>(FASE_MATA_SLUGS)

export function normalizeFaseSlug(fase: string): string | null {
  const t = fase.trim().toLowerCase().replace(/\s+/g, '_')
  const aliases: Record<string, string> = {
    semifinal: 'semi',
    semi_final: 'semi',
    oitavas_de_final: 'oitavas',
  }
  const x = aliases[t] || t
  return FASE_MATA_SLUG_SET.has(x) ? x : null
}

export function faseLabel(jogo: Jogo): string {
  if (jogo.tipo_fase === 'mata_mata') {
    const slug = normalizeFaseSlug(jogo.fase)
    return slug ? labelFaseMataPorSlug(slug) : jogo.fase
  }
  return jogo.fase
}

/** True se `jogo.fase` já contém a rodada numérica (evita "…Rodada 1 · Rodada 1" no header). */
export function jogoFaseJaMencionaRodada(jogo: Jogo): boolean {
  if (jogo.rodada == null) return false
  return new RegExp(`rodada\\s*${jogo.rodada}\\b`, 'i').test(jogo.fase)
}

/** Chave estável para agrupar/filtrar palpites por rodada (grupos) ou fase (mata-mata). */
export function palpiteSegmentKey(jogo: Jogo): string {
  if (jogo.tipo_fase === 'grupos') {
    const r = jogo.rodada ?? 0
    return `grupos:rodada:${r}`
  }
  const slug = normalizeFaseSlug(jogo.fase)
  if (slug) return `mata:${slug}`
  const raw = jogo.fase.trim().toLowerCase().replace(/\s+/g, '_')
  return `mata:raw:${raw}`
}

/** Rótulo curto para chips de filtro (Palpites). */
export function palpiteSegmentLabel(jogo: Jogo): string {
  if (jogo.tipo_fase === 'grupos') {
    return jogo.rodada != null ? `Rodada ${jogo.rodada}` : 'Grupos'
  }
  return faseLabel(jogo)
}

export interface PalpiteSegmentOption {
  key: string
  label: string
}

const GRUPOS_RODADA_PREFIX = 'grupos:rodada:'
const MATA_SEGMENT_PREFIX = 'mata:'
const UNKNOWN_PALPITE_SEGMENT_RANK = 10_000

function palpiteSegmentSortRank(key: string): number {
  if (key.startsWith(GRUPOS_RODADA_PREFIX)) {
    const rodada = Number(key.slice(GRUPOS_RODADA_PREFIX.length))
    return Number.isFinite(rodada) ? rodada : UNKNOWN_PALPITE_SEGMENT_RANK
  }
  if (key.startsWith(MATA_SEGMENT_PREFIX)) {
    const slug = key.slice(MATA_SEGMENT_PREFIX.length)
    if (slug.startsWith('raw:')) return UNKNOWN_PALPITE_SEGMENT_RANK
    const idx = FASE_MATA_SLUGS.indexOf(slug as (typeof FASE_MATA_SLUGS)[number])
    return idx === -1 ? UNKNOWN_PALPITE_SEGMENT_RANK - 1 : 100 + idx
  }
  return UNKNOWN_PALPITE_SEGMENT_RANK
}

export function comparePalpiteSegmentKeys(a: string, b: string): number {
  const diff = palpiteSegmentSortRank(a) - palpiteSegmentSortRank(b)
  return diff !== 0 ? diff : a.localeCompare(b)
}

/** Opções de segmento a partir dos jogos já filtrados; ordenadas pela sequência do torneio. */
export function palpiteSegmentOptionsFromJogos(jogos: Jogo[]): PalpiteSegmentOption[] {
  if (!jogos.length) return []
  const byKey = new Map<string, string>()
  for (const j of jogos) {
    const k = palpiteSegmentKey(j)
    if (!byKey.has(k)) {
      byKey.set(k, palpiteSegmentLabel(j))
    }
  }
  return [...byKey.entries()]
    .sort(([keyA, labelA], [keyB, labelB]) => {
      const cmp = comparePalpiteSegmentKeys(keyA, keyB)
      return cmp !== 0 ? cmp : labelA.localeCompare(labelB)
    })
    .map(([key, label]) => ({ key, label }))
}

/**
 * Segmento padrão: primeiro jogo na ordem de exibição da lista (abertos = crescente; fechados = decrescente).
 */
export function palpiteDefaultSegmentKey(jogosEmOrdemDeExibicao: Jogo[]): string | null {
  if (!jogosEmOrdemDeExibicao.length) return null
  return palpiteSegmentKey(jogosEmOrdemDeExibicao[0])
}

export function isBrasil(jogo: Jogo): boolean {
  return jogo.pais_casa?.sigla === 'BR' || jogo.pais_fora?.sigla === 'BR'
}

/** Timestamp UTC do início do jogo (ISO do backend). */
export function dataJogoParaMs(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : NaN
}

/** Ordem crescente por horário de início do jogo (desempate estável por id). */
export function compareJogosPorDataJogoAsc(a: Jogo, b: Jogo): number {
  const ta = dataJogoParaMs(a.data_jogo)
  const tb = dataJogoParaMs(b.data_jogo)
  const fa = Number.isFinite(ta)
  const fb = Number.isFinite(tb)
  if (!fa && !fb) return a.id - b.id
  if (!fa) return 1
  if (!fb) return -1
  if (ta !== tb) return ta - tb
  return a.id - b.id
}

/** Corta datas muito antigas do cálculo do 1º jogo quando há jogos mais recentes na mesma rodada/fase (evita linha lixo no BD bloquear tudo). */
function menorHorarioRelevante(timestamps: number[]): number | null {
  if (!timestamps.length) return null
  const now = Date.now()
  const cutoff = now - 400 * 24 * 3_600_000
  const recentes = timestamps.filter((t) => t >= cutoff)
  const usar = recentes.length ? recentes : timestamps
  return Math.min(...usar)
}

export function primeiroInicioGrupoPorRodada(jogos: Jogo[], rodada: number): number | null {
  const ts = jogos
    .filter((j) => j.tipo_fase === 'grupos' && Number(j.rodada) === Number(rodada))
    .map((j) => dataJogoParaMs(j.data_jogo))
    .filter(Number.isFinite)
  return menorHorarioRelevante(ts)
}

export function primeiroInicioMataPorFase(jogos: Jogo[], slug: string): number | null {
  const ts = jogos
    .filter((j) => j.tipo_fase === 'mata_mata' && normalizeFaseSlug(j.fase) === slug)
    .map((j) => dataJogoParaMs(j.data_jogo))
    .filter(Number.isFinite)
  return menorHorarioRelevante(ts)
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

  const inicio = dataJogoParaMs(jogo.data_jogo)
  return Number.isFinite(inicio) ? inicio - MS_1H : inicio
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

const NOMES_SELECAO_CARD: Record<string, string> = {
  'República Tcheca': 'Rep. Tcheca',
  'Estados Unidos': 'EUA',
  'Coreia do Sul': 'Coreia do Sul',
}

export function nomeSelecaoParaCard(nome: string, sigla: string): string {
  const abreviado = NOMES_SELECAO_CARD[nome]
  if (abreviado) return abreviado
  if (nome.length > 20) return sigla
  return nome
}

export type DeadlineUrgency = 'normal' | 'soon' | 'urgent'

export function deadlineText(
  jogo: Jogo,
  todosJogos: Jogo[],
): { text: string; urgency: DeadlineUrgency } | null {
  if (jogo.finalizado) return null
  const lim = momentoFimEdicao(jogo, todosJogos)
  if (!Number.isFinite(lim)) return null
  const diff = lim - Date.now()
  if (diff <= 0) return null

  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const MS_24H = 24 * 3_600_000
  const MS_1H = 3_600_000

  let text: string
  let urgency: DeadlineUrgency

  if (diff > MS_24H) {
    const d = Math.floor(h / 24)
    text = `Fecha em ${d} ${pluralize(d, 'dia', 'dias')}`
    urgency = 'normal'
  } else if (diff > MS_1H) {
    if (h >= 1) {
      text = `Fecha em ${h}h${m > 0 ? ` ${m}min` : ''}`
    } else {
      text = `Fecha em ${m}min`
    }
    urgency = 'soon'
  } else if (m >= 1) {
    text = `Fecha em ${m}min`
    urgency = 'urgent'
  } else {
    text = 'Fecha em breve'
    urgency = 'urgent'
  }

  return { text, urgency }
}
