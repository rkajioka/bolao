import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Users, Globe, Trophy, Star, Shield } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'
import { SectionHeader } from '@/components/SectionHeader'
import { CountryFlag } from '@/components/CountryFlag'
import { AutocompleteInput } from '@/components/AutocompleteInput'
import type { Jogo, User, Pais, ConfiguracaoBolao, PontuacaoFase } from '@/types'
import { formatDate, faseLabel } from '@/lib/utils'

type AdminTab = 'jogos' | 'usuarios' | 'paises' | 'especiais' | 'config'

const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
  { key: 'jogos', label: 'Jogos', icon: <Trophy size={16} /> },
  { key: 'usuarios', label: 'Usuários', icon: <Users size={16} /> },
  { key: 'paises', label: 'Países', icon: <Globe size={16} /> },
  { key: 'especiais', label: 'Especiais', icon: <Star size={16} /> },
  { key: 'config', label: 'Config', icon: <Settings size={16} /> },
]

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('jogos')
  const { success, error } = useToast()
  const queryClient = useQueryClient()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,92,122,0.15)', border: '1px solid rgba(255,92,122,0.3)' }}
        >
          <Shield size={16} style={{ color: 'var(--danger)' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold">Administração</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Painel de gerenciamento do bolão</p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150"
            style={{
              background: activeTab === t.key ? 'rgba(255,255,255,0.10)' : 'transparent',
              border: `1px solid ${activeTab === t.key ? 'rgba(255,255,255,0.15)' : 'transparent'}`,
              color: activeTab === t.key ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'jogos' && <AdminJogos success={success} error={error} queryClient={queryClient} />}
          {activeTab === 'usuarios' && <AdminUsuarios success={success} error={error} queryClient={queryClient} />}
          {activeTab === 'paises' && <AdminPaises success={success} error={error} queryClient={queryClient} />}
          {activeTab === 'especiais' && <AdminEspeciais success={success} error={error} queryClient={queryClient} />}
          {activeTab === 'config' && <AdminConfig success={success} error={error} queryClient={queryClient} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

interface AdminSectionProps {
  success: (msg: string) => void
  error: (msg: string) => void
  queryClient: ReturnType<typeof useQueryClient>
}

function AdminJogos({ success, error, queryClient }: AdminSectionProps) {
  const { data: jogos = [], isLoading } = useQuery({
    queryKey: ['jogos', 'cronologico'],
    queryFn: () => api.get<Jogo[]>('/jogos/cronologico'),
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [result, setResult] = useState({ placar_casa: 0, placar_fora: 0, finalizar: false })
  const [editingMarcadoresId, setEditingMarcadoresId] = useState<number | null>(null)
  const [marcadoresForm, setMarcadoresForm] = useState<Record<number, { nome_jogador: string; quantidade_gols: number }[]>>({})

  const { data: candidatosAdmin = [] } = useQuery({
    queryKey: ['marcadores', 'candidatos', 'admin'],
    queryFn: () => api.get<{ id: number; nome: string; ativo: boolean }[]>('/marcadores-brasil/candidatos/admin'),
  })

  const handleFinalize = async (jogo: Jogo) => {
    try {
      if (!jogo.finalizado) {
        await api.patch(`/jogos/${jogo.id}/resultado`, {
          placar_casa: result.placar_casa,
          placar_fora: result.placar_fora,
        })
        if (result.finalizar) {
          await api.patch(`/jogos/${jogo.id}/finalizar`, {})
        }
        await queryClient.invalidateQueries({ queryKey: ['jogos'] })
        success('Resultado salvo!')
        setEditingId(null)
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar resultado')
    }
  }

  const openMarcadores = async (jogoId: number) => {
    try {
      const existentes = await api.get<{ nome_jogador: string; quantidade_gols: number }[]>(`/marcadores-brasil/admin/${jogoId}`)
      setMarcadoresForm((old) => ({ ...old, [jogoId]: existentes.length ? existentes : [{ nome_jogador: '', quantidade_gols: 1 }] }))
      setEditingMarcadoresId((v) => (v === jogoId ? null : jogoId))
    } catch {
      setMarcadoresForm((old) => ({ ...old, [jogoId]: [{ nome_jogador: '', quantidade_gols: 1 }] }))
      setEditingMarcadoresId((v) => (v === jogoId ? null : jogoId))
    }
  }

  const salvarMarcadores = async (jogoId: number) => {
    try {
      const linhas = (marcadoresForm[jogoId] || []).filter((x) => x.nome_jogador.trim())
      await api.put(`/marcadores-brasil/resultado/${jogoId}`, { marcadores: linhas })
      await api.patch(`/marcadores-brasil/recalcular/${jogoId}`)
      success('Marcadores do Brasil salvos')
      setEditingMarcadoresId(null)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar marcadores do Brasil')
    }
  }

  if (isLoading) return <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Carregando…</div>

  return (
    <div className="space-y-3">
      {jogos.map((jogo) => (
        <div key={jogo.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {faseLabel(jogo)} · {formatDate(jogo.data_jogo)}
              </p>
              <p className="font-semibold text-sm mt-0.5">
                {jogo.pais_casa.nome} vs {jogo.pais_fora.nome}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {jogo.finalizado ? (
                <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: 'var(--highlight-dim)', color: 'var(--highlight)', border: '1px solid rgba(246,198,91,0.3)' }}>
                  Finalizado
                </span>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEditingId(editingId === jogo.id ? null : jogo.id)}
                    className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'var(--text)',
                    }}
                  >
                    {editingId === jogo.id ? 'Fechar' : 'Resultado'}
                  </button>
                  {(jogo.pais_casa.sigla === 'BR' || jogo.pais_fora.sigla === 'BR') && (
                    <button
                      onClick={() => openMarcadores(jogo.id)}
                      className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                      style={{
                        background: 'rgba(246,198,91,0.10)',
                        border: '1px solid rgba(246,198,91,0.3)',
                        color: 'var(--highlight)',
                      }}
                    >
                      Marcadores BR
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {jogo.placar_casa !== null && (
            <p className="text-xs" style={{ color: 'var(--accent)' }}>
              Resultado: {jogo.placar_casa} × {jogo.placar_fora}
            </p>
          )}

          <AnimatePresence>
            {editingId === jogo.id && !jogo.finalizado && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 space-y-3" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 flex-1">
                      <CountryFlag pais={jogo.pais_casa} size="sm" />
                      <input
                        type="number" min={0}
                        value={result.placar_casa}
                        onChange={(e) => setResult((r) => ({ ...r, placar_casa: parseInt(e.target.value) || 0 }))}
                        className="w-16 text-center text-lg font-bold py-2 rounded-xl outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                      />
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>×</span>
                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      <input
                        type="number" min={0}
                        value={result.placar_fora}
                        onChange={(e) => setResult((r) => ({ ...r, placar_fora: parseInt(e.target.value) || 0 }))}
                        className="w-16 text-center text-lg font-bold py-2 rounded-xl outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                      />
                      <CountryFlag pais={jogo.pais_fora} size="sm" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={result.finalizar}
                      onChange={(e) => setResult((r) => ({ ...r, finalizar: e.target.checked }))}
                      className="w-4 h-4 rounded"
                    />
                    <span style={{ color: 'var(--text-muted)' }}>Finalizar jogo (pontos calculados)</span>
                  </label>
                  <button
                    onClick={() => handleFinalize(jogo)}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--accent)', color: '#070A12' }}
                  >
                    Salvar resultado
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {editingMarcadoresId === jogo.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 mt-3 space-y-2" style={{ borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  {(marcadoresForm[jogo.id] || []).map((m, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <AutocompleteInput
                        value={m.nome_jogador}
                        onChange={(val) =>
                          setMarcadoresForm((old) => ({
                            ...old,
                            [jogo.id]: (old[jogo.id] || []).map((x, i) => i === idx ? { ...x, nome_jogador: val } : x),
                          }))
                        }
                        options={candidatosAdmin.filter((c) => c.ativo).map((c) => c.nome)}
                        placeholder="Nome do jogador"
                      />
                      <input
                        type="number"
                        min={0}
                        value={m.quantidade_gols}
                        onChange={(e) =>
                          setMarcadoresForm((old) => ({
                            ...old,
                            [jogo.id]: (old[jogo.id] || []).map((x, i) => i === idx ? { ...x, quantidade_gols: parseInt(e.target.value) || 0 } : x),
                          }))
                        }
                        className="w-16 px-2 py-2 rounded-xl text-sm text-center outline-none"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setMarcadoresForm((old) => ({
                          ...old,
                          [jogo.id]: [...(old[jogo.id] || []), { nome_jogador: '', quantidade_gols: 1 }],
                        }))
                      }
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
                    >
                      + Adicionar
                    </button>
                    <button
                      onClick={() => salvarMarcadores(jogo.id)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'var(--highlight-dim)', border: '1px solid rgba(246,198,91,0.3)', color: 'var(--highlight)' }}
                    >
                      Salvar marcadores
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

function AdminUsuarios({ success, error, queryClient }: AdminSectionProps) {
  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get<User[]>('/usuarios'),
  })

  const toggleStatus = async (u: User) => {
    try {
      await api.patch(`/usuarios/${u.id}/status`, { ativo: !u.ativo })
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      success(`Usuário ${u.ativo ? 'desativado' : 'ativado'}`)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    }
  }

  const resetPassword = async (u: User) => {
    if (!confirm(`Resetar senha de ${u.nome}?`)) return
    try {
      await api.patch(`/usuarios/${u.id}/reset-password`, {})
      success('Senha resetada para o padrão')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <div className="space-y-2">
      {usuarios.map((u) => (
        <div key={u.id} className="glass rounded-2xl p-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {u.nome.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{u.nome}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: u.ativo ? 'var(--accent-dim)' : 'var(--danger-dim)',
                  color: u.ativo ? 'var(--accent)' : 'var(--danger)',
                  border: `1px solid ${u.ativo ? 'rgba(53,208,127,0.3)' : 'rgba(255,92,122,0.3)'}`,
                }}
              >
                {u.ativo ? 'Ativo' : 'Inativo'}
              </span>
              {u.tipo_usuario === 'admin' && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(255,92,122,0.3)' }}>
                  Admin
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => toggleStatus(u)}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            >
              {u.ativo ? 'Desativar' : 'Ativar'}
            </button>
            <button
              onClick={() => resetPassword(u)}
              className="text-xs px-2 py-1 rounded-lg font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}
            >
              Reset senha
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminPaises({ success, error, queryClient }: AdminSectionProps) {
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => api.get<Pais[]>('/paises'),
  })

  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nome: '', sigla: '', grupo: '', bandeira_url: '' })

  const startEdit = (p: Pais) => {
    setEditId(p.id)
    setEditForm({ nome: p.nome, sigla: p.sigla, grupo: p.grupo || '', bandeira_url: p.bandeira_url || '' })
  }

  const saveEdit = async () => {
    if (!editId) return
    try {
      await api.put(`/paises/${editId}`, editForm)
      await queryClient.invalidateQueries({ queryKey: ['paises'] })
      success('País atualizado')
      setEditId(null)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'var(--text)',
    borderRadius: '0.75rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  return (
    <div className="space-y-2">
      {paises.map((p) => (
        <div key={p.id} className="glass rounded-2xl p-4">
          {editId === p.id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={editForm.nome} onChange={(e) => setEditForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome" style={inputStyle} />
                <input value={editForm.sigla} onChange={(e) => setEditForm((f) => ({ ...f, sigla: e.target.value }))} placeholder="Sigla" style={inputStyle} />
                <input value={editForm.grupo} onChange={(e) => setEditForm((f) => ({ ...f, grupo: e.target.value }))} placeholder="Grupo" style={inputStyle} />
                <input value={editForm.bandeira_url} onChange={(e) => setEditForm((f) => ({ ...f, bandeira_url: e.target.value }))} placeholder="URL bandeira" style={inputStyle} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--accent)', color: '#070A12' }}>Salvar</button>
                <button onClick={() => setEditId(null)} className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CountryFlag pais={p} size="md" />
              <div className="flex-1">
                <p className="font-semibold text-sm">{p.nome}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sigla}{p.grupo ? ` · Grupo ${p.grupo}` : ''}</p>
              </div>
              <button onClick={() => startEdit(p)} className="text-xs px-3 py-1.5 rounded-xl font-medium" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-muted)' }}>
                Editar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AdminEspeciais({ success, error, queryClient }: AdminSectionProps) {
  const { data: config } = useQuery({
    queryKey: ['configuracao-bolao'],
    queryFn: () => api.get<ConfiguracaoBolao>('/configuracao-bolao'),
  })

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div>
          <p className="font-semibold text-sm">Palpites especiais</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            O bloqueio efetivo é calculado pela data de bloqueio da configuração do bolão.
          </p>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Data de bloqueio atual: {config?.data_bloqueio_palpites_especiais ? formatDate(config.data_bloqueio_palpites_especiais) : 'Automática (2h antes do primeiro jogo)'}
        </p>
      </div>
    </div>
  )
}

function AdminConfig({ success, error, queryClient }: AdminSectionProps) {
  const [form, setForm] = useState<ConfiguracaoBolao | null>(null)
  const [fases, setFases] = useState<PontuacaoFase[]>([])
  const [saving, setSaving] = useState(false)

  const { data: config } = useQuery({
    queryKey: ['configuracao-bolao'],
    queryFn: () => api.get<ConfiguracaoBolao>('/configuracao-bolao'),
    onSuccess: (data: ConfiguracaoBolao) => setForm(data),
  } as any)

  useQuery({
    queryKey: ['configuracao-pontuacao-fase'],
    queryFn: () => api.get<PontuacaoFase[]>('/configuracao-pontuacao-fase'),
    onSuccess: (data: PontuacaoFase[]) => setFases(data),
  } as any)

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      await api.put('/configuracao-bolao', {
        data_bloqueio_palpites_especiais: form.data_bloqueio_palpites_especiais,
        pontos_campeao: form.pontos_campeao,
        pontos_vice_campeao: form.pontos_vice_campeao,
        pontos_terceiro_lugar: form.pontos_terceiro_lugar,
        pontos_artilheiro_pais: form.pontos_artilheiro_pais,
        pontos_melhor_jogador: form.pontos_melhor_jogador,
        pontos_artilheiro: form.pontos_artilheiro,
        pontos_melhor_goleiro: form.pontos_melhor_goleiro,
        pontos_placar_exato: form.pontos_placar_exato,
        pontos_resultado_correto: form.pontos_resultado_correto,
        pontos_classificado_mata_mata: form.pontos_classificado_mata_mata,
        pontos_marcador_brasil: form.pontos_marcador_brasil,
        pontos_marcador_brasil_com_quantidade: form.pontos_marcador_brasil_com_quantidade,
      })
      await api.put('/configuracao-pontuacao-fase', {
        itens: fases.map((f) => ({
          fase_key: f.fase_key,
          label: f.label,
          ordem: f.ordem,
          pontos_placar_exato: f.pontos_placar_exato,
          pontos_resultado_correto: f.pontos_resultado_correto,
          pontos_classificado_mata_mata: f.pontos_classificado_mata_mata,
        })),
      })
      await queryClient.invalidateQueries({ queryKey: ['configuracao-bolao'] })
      await queryClient.invalidateQueries({ queryKey: ['configuracao-pontuacao-fase'] })
      success('Configuração salva')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div>
        <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Bloqueio de especiais (ISO)
        </label>
        <input
          type="datetime-local"
          value={(form?.data_bloqueio_palpites_especiais || '').slice(0, 16)}
          onChange={(e) => setForm((old) => (old ? { ...old, data_bloqueio_palpites_especiais: e.target.value ? new Date(e.target.value).toISOString() : null } : old))}
          className="w-full px-3 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['pontos_campeao', 'Campeão'],
          ['pontos_vice_campeao', 'Vice'],
          ['pontos_terceiro_lugar', '3º lugar'],
          ['pontos_artilheiro_pais', 'País do artilheiro'],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
            <input
              type="number"
              min={0}
              value={form ? (form as any)[key] : 0}
              onChange={(e) => setForm((old) => (old ? { ...old, [key]: parseInt(e.target.value) || 0 } : old))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Pontuação por fase
        </p>
        {fases.map((f) => (
          <div key={f.fase_key} className="grid grid-cols-12 gap-2 items-center">
            <p className="col-span-5 text-xs" style={{ color: 'var(--text-muted)' }}>{f.label}</p>
            <input
              type="number"
              min={0}
              value={f.pontos_placar_exato}
              onChange={(e) => setFases((old) => old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_placar_exato: parseInt(e.target.value) || 0 } : x))}
              className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
            />
            <input
              type="number"
              min={0}
              value={f.pontos_resultado_correto}
              onChange={(e) => setFases((old) => old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_resultado_correto: parseInt(e.target.value) || 0 } : x))}
              className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
            />
            <input
              type="number"
              min={0}
              value={f.pontos_classificado_mata_mata}
              onChange={(e) => setFases((old) => old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_classificado_mata_mata: parseInt(e.target.value) || 0 } : x))}
              className="col-span-3 px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
        style={{ background: 'var(--accent)', color: '#070A12' }}
      >
        {saving ? 'Salvando…' : 'Salvar configuração'}
      </button>
    </div>
  )
}
