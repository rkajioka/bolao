import { describe, expect, it, vi } from 'vitest'
import {
  comparePalpiteSegmentKeys,
  deadlineText,
  flagImgUrl,
  imgUrl,
  jogoBloqueado,
  mensagemPodioRepetidoEspeciais,
  nomeSelecaoParaCard,
  palpiteSegmentOptionsFromJogos,
} from '@/lib/utils'
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

describe('imgUrl / flagImgUrl', () => {
  it('imgUrl bloqueia URLs externas (avatar)', () => {
    expect(imgUrl('https://evil.example/a.png')).toBe('')
    expect(imgUrl('/static/uploads/avatars/abc.jpg')).toBe('/static/uploads/avatars/abc.jpg')
  })

  it('flagImgUrl permite flagcdn e caminhos locais', () => {
    expect(flagImgUrl('https://flagcdn.com/w40/br.png')).toBe('https://flagcdn.com/w40/br.png')
    expect(flagImgUrl('/static/bandeiras/br.png')).toBe('/static/bandeiras/br.png')
    expect(flagImgUrl(null)).toBe('')
  })
})

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

describe('palpiteSegmentOptionsFromJogos', () => {
  it('ordena rodadas pelo número da rodada, não pela data do jogo', () => {
    const jogos = [
      jogoBase({ id: 1, rodada: 3, data_jogo: '2030-06-10T18:00:00Z' }),
      jogoBase({ id: 2, rodada: 1, data_jogo: '2030-06-20T18:00:00Z' }),
      jogoBase({ id: 3, rodada: 2, data_jogo: '2030-06-15T18:00:00Z' }),
    ]

    expect(palpiteSegmentOptionsFromJogos(jogos).map((item) => item.label)).toEqual([
      'Rodada 1',
      'Rodada 2',
      'Rodada 3',
    ])
  })

  it('coloca mata-mata após as rodadas de grupos', () => {
    const jogos = [
      jogoBase({ id: 1, rodada: 3, data_jogo: '2030-06-10T18:00:00Z' }),
      jogoBase({
        id: 2,
        tipo_fase: 'mata_mata',
        rodada: null,
        fase: 'dezesseis_avos',
        data_jogo: '2030-06-05T18:00:00Z',
      }),
      jogoBase({
        id: 3,
        tipo_fase: 'mata_mata',
        rodada: null,
        fase: 'oitavas',
        data_jogo: '2030-06-12T18:00:00Z',
      }),
      jogoBase({
        id: 4,
        tipo_fase: 'mata_mata',
        rodada: null,
        fase: 'quartas',
        data_jogo: '2030-06-14T18:00:00Z',
      }),
      jogoBase({
        id: 5,
        tipo_fase: 'mata_mata',
        rodada: null,
        fase: 'semi',
        data_jogo: '2030-06-16T18:00:00Z',
      }),
    ]

    expect(palpiteSegmentOptionsFromJogos(jogos).map((item) => item.label)).toEqual([
      'Rodada 3',
      '16-avos',
      'Oitavas',
      'Quartas',
      'Semifinal',
    ])
  })

  it('omite rodadas ausentes no conjunto filtrado', () => {
    const jogos = [
      jogoBase({ id: 1, rodada: 1, data_jogo: '2030-06-10T18:00:00Z' }),
      jogoBase({ id: 2, rodada: 3, data_jogo: '2030-06-20T18:00:00Z' }),
    ]

    expect(palpiteSegmentOptionsFromJogos(jogos).map((item) => item.label)).toEqual([
      'Rodada 1',
      'Rodada 3',
    ])
  })
})

describe('comparePalpiteSegmentKeys', () => {
  it('mantém a ordem canônica entre grupos e mata-mata', () => {
    expect(comparePalpiteSegmentKeys('grupos:rodada:1', 'grupos:rodada:2')).toBeLessThan(0)
    expect(comparePalpiteSegmentKeys('grupos:rodada:3', 'mata:dezesseis_avos')).toBeLessThan(0)
    expect(comparePalpiteSegmentKeys('mata:oitavas', 'mata:quartas')).toBeLessThan(0)
    expect(comparePalpiteSegmentKeys('mata:semi', 'mata:final')).toBeLessThan(0)
  })
})
