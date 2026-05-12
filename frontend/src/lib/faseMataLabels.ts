export const FASE_MATA_SLUGS = [
  'dezesseis_avos',
  'oitavas',
  'quartas',
  'semi',
  'terceiro_lugar',
  'final',
] as const

export type FaseMataSlug = (typeof FASE_MATA_SLUGS)[number]

export const FASE_MATA_LABELS: Record<FaseMataSlug, string> = {
  dezesseis_avos: '16-avos',
  oitavas: 'Oitavas',
  quartas: 'Quartas',
  semi: 'Semifinal',
  terceiro_lugar: '3º lugar',
  final: 'Final',
}

export const FASES_MATA_MATA_OPTIONS = FASE_MATA_SLUGS.map((value) => ({
  value,
  label: FASE_MATA_LABELS[value],
}))

export function labelFaseMataPorSlug(slug: string): string {
  if (slug in FASE_MATA_LABELS) {
    return FASE_MATA_LABELS[slug as FaseMataSlug]
  }
  return slug
}
