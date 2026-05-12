import { describe, expect, it } from 'vitest'
import { FASE_MATA_LABELS, FASE_MATA_SLUGS, labelFaseMataPorSlug } from '@/lib/faseMataLabels'

describe('faseMataLabels', () => {
  it('mapeia os seis slugs canônicos do mata-mata', () => {
    expect(FASE_MATA_SLUGS).toEqual([
      'dezesseis_avos',
      'oitavas',
      'quartas',
      'semi',
      'terceiro_lugar',
      'final',
    ])
    expect(FASE_MATA_LABELS.dezesseis_avos).toBe('16-avos')
    expect(FASE_MATA_LABELS.oitavas).toBe('Oitavas')
    expect(FASE_MATA_LABELS.quartas).toBe('Quartas')
    expect(FASE_MATA_LABELS.semi).toBe('Semifinal')
    expect(FASE_MATA_LABELS.terceiro_lugar).toBe('3º lugar')
    expect(FASE_MATA_LABELS.final).toBe('Final')
  })

  it('retorna o slug quando não reconhecido', () => {
    expect(labelFaseMataPorSlug('fase_custom')).toBe('fase_custom')
  })
})
