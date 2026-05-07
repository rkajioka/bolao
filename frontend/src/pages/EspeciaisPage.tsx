import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Lock, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { SectionHeader } from '@/components/SectionHeader'
import { CountryFlag } from '@/components/CountryFlag'
import type { PalpiteEspecial, Pais, MarcadorCandidato } from '@/types'

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

  const { data: candidatos = [] } = useQuery({
    queryKey: ['marcadores', 'candidatos'],
    queryFn: () => api.get<MarcadorCandidato[]>('/marcadores-brasil/candidatos'),
  })

  const [form, setForm] = useState({
    campeao_id: '',
    melhor_jogador: '',
    artilheiro: '',
    melhor_goleiro: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (palpite) {
      setForm({
        campeao_id: palpite.campeao_id ? String(palpite.campeao_id) : '',
        melhor_jogador: palpite.melhor_jogador || '',
        artilheiro: palpite.artilheiro || '',
        melhor_goleiro: palpite.melhor_goleiro || '',
      })
    }
  }, [palpite])

  const bloqueado = palpite?.bloqueado ?? false

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        campeao_id: form.campeao_id ? parseInt(form.campeao_id) : null,
        melhor_jogador: form.melhor_jogador || null,
        artilheiro: form.artilheiro || null,
        melhor_goleiro: form.melhor_goleiro || null,
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

  const candidatoNames = candidatos.map((c) => c.nome)
  const selectedPais = paises.find((p) => String(p.id) === form.campeao_id)

  const inputClass = "w-full px-3 py-3 rounded-xl text-sm transition-all duration-150 outline-none disabled:opacity-40"
  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'var(--text)',
  }

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
          {/* Campeão */}
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--highlight)' }}>
              <Star size={12} />
              Campeão do torneio
            </label>
            <div className="relative">
              {selectedPais && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <CountryFlag pais={selectedPais} size="sm" />
                </div>
              )}
              <select
                value={form.campeao_id}
                onChange={(e) => setForm((f) => ({ ...f, campeao_id: e.target.value }))}
                disabled={bloqueado}
                className={inputClass}
                style={{ ...inputStyle, paddingLeft: selectedPais ? '3.5rem' : '0.75rem' }}
              >
                <option value="">Selecione o campeão</option>
                {paises.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Text fields */}
          {[
            { key: 'melhor_jogador', label: 'Melhor jogador', placeholder: 'Nome do jogador' },
            { key: 'artilheiro', label: 'Artilheiro', placeholder: 'Nome do artilheiro' },
            { key: 'melhor_goleiro', label: 'Melhor goleiro', placeholder: 'Nome do goleiro' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {label}
              </label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                disabled={bloqueado}
                placeholder={placeholder}
                list={`dl-${key}`}
                className={inputClass}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(246,198,91,0.5)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <datalist id={`dl-${key}`}>
                {candidatoNames.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          ))}

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
                { label: 'Melhor jogador', pts: palpite.pontuacao_melhor_jogador },
                { label: 'Artilheiro', pts: palpite.pontuacao_artilheiro },
                { label: 'Goleiro', pts: palpite.pontuacao_melhor_goleiro },
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
