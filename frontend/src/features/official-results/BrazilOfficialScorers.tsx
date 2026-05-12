import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BrazilScorers } from '@/components/GameCard/BrazilScorers'
import { isBrasil } from '@/lib/utils'
import { gamesService } from '@/services/games.service'
import type { Jogo, MarcadorCandidato } from '@/types'

interface BrazilOfficialScorersProps {
  jogo: Jogo
  placarCasa: number
  placarFora: number
  bloqueado: boolean
  onError?: (message: string) => void
  onSaved?: () => void | Promise<void>
}

export function BrazilOfficialScorers({
  jogo,
  placarCasa,
  placarFora,
  bloqueado,
  onError,
  onSaved,
}: BrazilOfficialScorersProps) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const golsBrasil = jogo.pais_casa.sigla === 'BR' ? placarCasa : placarFora

  const { data: candidatosAdmin = [] } = useQuery({
    queryKey: ['marcadores', 'candidatos', 'admin'],
    queryFn: () => gamesService.getCandidatesAdmin(),
  })

  const candidatos = useMemo<MarcadorCandidato[]>(
    () =>
      candidatosAdmin
        .filter((candidato) => candidato.ativo)
        .map((candidato) => ({
          id: candidato.id,
          nome: candidato.nome,
        })),
    [candidatosAdmin],
  )

  const { data: marcadoresSalvos = [] } = useQuery({
    queryKey: ['marcadores', 'admin', jogo.id],
    queryFn: () => gamesService.getMarcadoresAdmin(jogo.id),
    enabled: isBrasil(jogo),
  })

  const handleSave = async (marcadores: { nome_jogador: string; quantidade_gols: number }[]) => {
    setSaving(true)
    try {
      if (!jogo.finalizado) {
        await gamesService.updateResult(jogo.id, {
          placar_casa: placarCasa,
          placar_fora: placarFora,
        })
      }
      await gamesService.saveMarcadoresAdmin(jogo.id, marcadores)
      await gamesService.recalcularMarcadores(jogo.id)
      await queryClient.invalidateQueries({ queryKey: ['marcadores', 'admin', jogo.id] })
      await onSaved?.()
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Erro ao salvar marcadores')
      throw err
    } finally {
      setSaving(false)
    }
  }

  if (!isBrasil(jogo)) return null

  return (
    <BrazilScorers
      variant="resultado"
      marcadores={marcadoresSalvos}
      candidatos={candidatos}
      golsBrasil={golsBrasil}
      bloqueado={bloqueado}
      saving={saving}
      onSave={handleSave}
    />
  )
}
