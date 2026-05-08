import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { SectionHeader } from '@/components/SectionHeader'
import { CountryFlag } from '@/components/CountryFlag'
import { CountrySelect } from '@/components/CountrySelect'
import type { PalpiteEspecial, Pais } from '@/types'

export function EspeciaisPage() {
  const { success, error } = useToast()
  const queryClient = useQueryClient()

  const { data: palpite, isLoading: loadingPalpite } = useQuery({
    queryKey: ['palpites-especiais', 'me'],
    queryFn: () => api.get<PalpiteEspecial>('/palpites-especiais/me').catch(() => null),
  })

  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => api.get<Pais[]>('/paises'),
  })

  const [form, setForm] = useState({
    campeao_id: '',
    vice_campeao_id: '',
    terceiro_lugar_id: '',
    artilheiro_pais_id: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (palpite) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        campeao_id: palpite.campeao_id ? String(palpite.campeao_id) : '',
        vice_campeao_id: palpite.vice_campeao_id ? String(palpite.vice_campeao_id) : '',
        terceiro_lugar_id: palpite.terceiro_lugar_id ? String(palpite.terceiro_lugar_id) : '',
        artilheiro_pais_id: palpite.artilheiro_pais_id ? String(palpite.artilheiro_pais_id) : '',
      })
    }
  }, [palpite])

  const bloqueado = palpite?.bloqueado ?? false

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        campeao_id: form.campeao_id ? parseInt(form.campeao_id) : null,
        vice_campeao_id: form.vice_campeao_id ? parseInt(form.vice_campeao_id) : null,
        terceiro_lugar_id: form.terceiro_lugar_id ? parseInt(form.terceiro_lugar_id) : null,
        artilheiro_pais_id: form.artilheiro_pais_id ? parseInt(form.artilheiro_pais_id) : null,
      }
      if (palpite) {
        await api.put('/palpites-especiais/me', body)
      } else {
        await api.post('/palpites-especiais', body)
      }
      await queryClient.invalidateQueries({ queryKey: ['palpites-especiais'] })
      success('Palpites especiais salvos!')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const selectedPais = paises.find((p) => String(p.id) === form.campeao_id)
  const selectedVice = paises.find((p) => String(p.id) === form.vice_campeao_id)
  const selectedTerceiro = paises.find((p) => String(p.id) === form.terceiro_lugar_id)
  const selectedArtilheiroPais = paises.find((p) => String(p.id) === form.artilheiro_pais_id)

  return (
    <div className="space-y-4">
      <SectionHeader title="Palpites Especiais" subtitle="Defina seus palpites para o torneio" />

      {bloqueado && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--danger-dim)', border: '1px solid rgba(255,92,122,0.3)' }}
        >
          <Lock size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            Os palpites especiais foram bloqueados pelo administrador.
          </p>
        </div>
      )}

      {loadingPalpite ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-2xl p-4 animate-pulse">
              <div className="h-4 w-24 rounded mb-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="h-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 space-y-5"
        >
          {[
            { key: 'campeao_id', label: 'Campeão', selected: selectedPais, placeholder: 'Selecione o campeão' },
            { key: 'vice_campeao_id', label: 'Vice-campeão', selected: selectedVice, placeholder: 'Selecione o vice-campeão' },
            { key: 'terceiro_lugar_id', label: '3º lugar', selected: selectedTerceiro, placeholder: 'Selecione o 3º lugar' },
            { key: 'artilheiro_pais_id', label: 'País do artilheiro', selected: selectedArtilheiroPais, placeholder: 'Selecione o país do artilheiro' },
          ].map(({ key, label, placeholder }, idx) => (
            <div key={key}>
              <label
                className="block text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5"
                style={{ color: idx === 0 ? 'var(--highlight)' : 'var(--text-muted)' }}
              >
                {idx === 0 ? <Star size={12} /> : null}
                {label}
              </label>
              <CountrySelect
                value={form[key as keyof typeof form]}
                countries={paises}
                onChange={(val) => setForm((f) => ({ ...f, [key]: val }))}
                placeholder={placeholder}
                disabled={bloqueado}
              />
            </div>
          ))}

          {/* Resumo da seleção com bandeiras */}
          <div className="pt-2 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Resumo</p>
            {[
              { label: 'Campeão', pais: selectedPais },
              { label: 'Vice-campeão', pais: selectedVice },
              { label: '3º lugar', pais: selectedTerceiro },
              { label: 'País do artilheiro', pais: selectedArtilheiroPais },
            ].map(({ label, pais }) => (
              <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
                {pais ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <CountryFlag pais={pais} size="sm" />
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{pais.nome}</span>
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Não definido</span>
                )}
              </div>
            ))}
          </div>

          {/* Points breakdown */}
          {palpite && (
            <div
              className="flex flex-wrap gap-2 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="w-full text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Pontuação atual
              </p>
              {[
                { label: 'Campeão', pts: palpite.pontuacao_campeao },
                { label: 'Vice-campeão', pts: palpite.pontuacao_vice_campeao ?? 0 },
                { label: '3º lugar', pts: palpite.pontuacao_terceiro_lugar ?? 0 },
                { label: 'País do artilheiro', pts: palpite.pontuacao_artilheiro_pais ?? 0 },
              ].map(({ label, pts }) => (
                <span
                  key={label}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: pts > 0 ? 'var(--accent-dim)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${pts > 0 ? 'rgba(53,208,127,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color: pts > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {label}: {pts} pts
                </span>
              ))}
            </div>
          )}

          {!bloqueado && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40"
              style={{ background: 'var(--highlight)', color: '#070A12' }}
            >
              {saving ? 'Salvando…' : palpite ? 'Atualizar palpites' : 'Salvar palpites'}
            </button>
          )}
        </motion.div>
      )}
    </div>
  )
}
