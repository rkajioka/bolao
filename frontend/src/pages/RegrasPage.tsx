import { SectionHeader } from '@/components/SectionHeader'

export function RegrasPage() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Regras" subtitle="Como funciona o bolão e a pontuação" />

      <div className="glass rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold mb-1.5">Palpites especiais</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            São preenchidos apenas uma vez e fecham 2 horas antes do primeiro jogo da Copa.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold mb-1.5">Fechamento por rodada</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Cada rodada fecha 2 horas antes do primeiro jogo daquela rodada. Depois do fechamento, não é possível editar ou preencher palpites pendentes.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold mb-1.5">Atualização dos jogos e tabela</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Os jogos são atualizados conforme resultados oficiais e a classificação dos grupos é recalculada automaticamente.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-bold mb-1.5">Pontuação por fase (padrão inicial)</h3>
          <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <p>Grupos (rodadas 1, 2 e 3): exato 10, resultado 5.</p>
            <p>32-avos: exato 12, resultado 6, classificado 6.</p>
            <p>16-avos: exato 14, resultado 7, classificado 7.</p>
            <p>Quartas: exato 16, resultado 8, classificado 8.</p>
            <p>Semifinal: exato 18, resultado 9, classificado 9.</p>
            <p>Disputa 3º lugar: exato 20, resultado 10, classificado 10.</p>
            <p>Final: exato 24, resultado 12, classificado 12.</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold mb-1.5">Pontuação especial</h3>
          <div className="space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <p>Campeão: 35 pontos.</p>
            <p>Vice-campeão: 25 pontos.</p>
            <p>3º lugar: 20 pontos.</p>
            <p>País do artilheiro: 20 pontos.</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold mb-1.5">Gols do Brasil</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Jogos da seleção brasileira têm bônus de marcadores. Os nomes são escolhidos de uma lista de candidatos cadastrada no sistema.
          </p>
        </div>
      </div>
    </div>
  )
}
