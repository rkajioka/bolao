import { describe, expect, it, vi } from 'vitest'
import { deadlineText, jogoBloqueado, mensagemPodioRepetidoEspeciais, nomeSelecaoParaCard } from '@/lib/utils'
import type { Jogo, Pais } from '@/types'

const paisA: Pais = {
  id: 1,
  nome: 'Time A',
  sigla: 'TA',
  grupo: 'A',
  bandeira_url: null,
}

const paisB: Pais = {
  id: 2,
  nome: 'Time B',
  sigla: 'TB',
  grupo: 'A',
  bandeira_url: null,
}

function jogoBase(overrides: Partial<Jogo> = {}): Jogo {
  return {
    id: 1,
    fase: 'Grupo A',
    grupo: 'A',
    tipo_fase: 'grupos',
    rodada: 1,
    pais_casa_id: 1,
    pais_fora_id: 2,
    data_jogo: '2030-06-15T18:00:00Z',
    placar_casa: null,
    placar_fora: null,
    teve_prorrogacao: false,
    foi_para_penaltis: false,
    penaltis_casa: null,
    penaltis_fora: null,
    classificado_id: null,
    finalizado: false,
    pais_casa: paisA,
    pais_fora: paisB,
    ...overrides,
  }
}

describe('mensagemPodioRepetidoEspeciais', () => {
  it('rejeita país repetido entre campeão, vice e terceiro', () => {
    expect(mensagemPodioRepetidoEspeciais('1', '1', '2')).toMatch(/distintos/i)
  })

  it('permite repetir país do pódio com artilheiro', () => {
    expect(mensagemPodioRepetidoEspeciais('1', '2', '3')).toBeNull()
  })
})

describe('nomeSelecaoParaCard', () => {
  it('abrevia nomes conhecidos', () => {
    expect(nomeSelecaoParaCard('República Tcheca', 'CZE')).toBe('Rep. Tcheca')
  })

  it('usa sigla para nomes muito longos', () => {
    expect(nomeSelecaoParaCard('Seleção com nome extenso demais', 'SEL')).toBe('SEL')
  })
})

describe('deadlineText', () => {
  it('retorna urgência normal acima de 24 horas', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-06-13T16:00:00Z'))
    const jogo = jogoBase()
    const result = deadlineText(jogo, [jogo])
    expect(result).toEqual({ text: 'Fecha em 2 dias', urgency: 'normal' })
    vi.useRealTimers()
  })

  it('retorna urgência soon abaixo de 24 horas', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-06-15T03:00:00Z'))
    const jogo = jogoBase()
    const result = deadlineText(jogo, [jogo])
    expect(result?.urgency).toBe('soon')
    expect(result?.text).toMatch(/^Fecha em /)
    vi.useRealTimers()
  })

  it('retorna urgência urgent abaixo de 1 hora', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-06-15T16:30:00Z'))
    const jogo = jogoBase()
    const result = deadlineText(jogo, [jogo])
    expect(result).toEqual({ text: 'Fecha em 30min', urgency: 'urgent' })
    vi.useRealTimers()
  })
})

describe('jogoBloqueado', () => {
  it('bloqueia jogo finalizado', () => {
    const jogo = jogoBase({ finalizado: true })
    expect(jogoBloqueado(jogo, [jogo])).toBe(true)
  })

  it('bloqueia após o prazo de edição', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-06-15T17:30:00Z'))
    const jogo = jogoBase()
    expect(jogoBloqueado(jogo, [jogo])).toBe(true)
    vi.useRealTimers()
  })

  it('mantém aberto antes do prazo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-06-15T16:00:00Z'))
    const jogo = jogoBase()
    expect(jogoBloqueado(jogo, [jogo])).toBe(false)
    vi.useRealTimers()
  })
})
