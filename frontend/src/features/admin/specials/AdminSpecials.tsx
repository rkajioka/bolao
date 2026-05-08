import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SelectInput } from '@/components/SelectInput'
import type { ConfiguracaoBolao, PontuacaoFase } from '@/types'
import { formatDate } from '@/lib/utils'
import { adminService } from '@/services/admin.service'

interface AdminSpecialsProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

const PONTUACAO_CONFIG_FIELDS: { key: keyof Pick<ConfiguracaoBolao,
  'pontos_campeao' | 'pontos_vice_campeao' | 'pontos_terceiro_lugar' | 'pontos_artilheiro_pais'
>; label: string }[] = [
  { key: 'pontos_campeao', label: 'Campeão' },
  { key: 'pontos_vice_campeao', label: 'Vice' },
  { key: 'pontos_terceiro_lugar', label: '3º lugar' },
  { key: 'pontos_artilheiro_pais', label: 'País do artilheiro' },
]

export function AdminSpecials({ success, error }: AdminSpecialsProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ConfiguracaoBolao | null>(null)
  const [fases, setFases] = useState<PontuacaoFase[]>([])
  const [savingConfig, setSavingConfig] = useState(false)
  const [savingResultado, setSavingResultado] = useState(false)
  const [resultadoForm, setResultadoForm] = useState({
    campeao_id: '',
    vice_campeao_id: '',
    terceiro_lugar_id: '',
    artilheiro_pais_id: '',
  })

  const { data: config } = useQuery({
    queryKey: ['configuracao-bolao'],
    queryFn: () => adminService.getConfig(),
  })
  const { data: fasesData = [] } = useQuery({
    queryKey: ['configuracao-pontuacao-fase'],
    queryFn: () => adminService.getFases(),
  })
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => adminService.getPaises(),
  })
  const { data: resultadoEspecial } = useQuery({
    queryKey: ['resultados-especiais', 'admin'],
    queryFn: () => adminService.getResultadoEspecial(),
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (config) setForm(config)
  }, [config])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFases(fasesData)
  }, [fasesData])

  useEffect(() => {
    if (!resultadoEspecial) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResultadoForm({
      campeao_id: resultadoEspecial.campeao_id ? String(resultadoEspecial.campeao_id) : '',
      vice_campeao_id: resultadoEspecial.vice_campeao_id ? String(resultadoEspecial.vice_campeao_id) : '',
      terceiro_lugar_id: resultadoEspecial.terceiro_lugar_id ? String(resultadoEspecial.terceiro_lugar_id) : '',
      artilheiro_pais_id: resultadoEspecial.artilheiro_pais_id ? String(resultadoEspecial.artilheiro_pais_id) : '',
    })
  }, [resultadoEspecial])

  const paisOptions = useMemo(
    () => paises.map((p) => ({ value: String(p.id), label: p.nome })),
    [paises],
  )

  const handleSaveConfiguracao = async () => {
    if (!form) return
    setSavingConfig(true)
    try {
      await adminService.updateConfig({
        data_bloqueio_palpites_especiais: form.data_bloqueio_palpites_especiais,
        pontos_campeao: form.pontos_campeao,
        pontos_vice_campeao: form.pontos_vice_campeao,
        pontos_terceiro_lugar: form.pontos_terceiro_lugar,
        pontos_artilheiro_pais: form.pontos_artilheiro_pais,
        pontos_placar_exato: form.pontos_placar_exato,
        pontos_resultado_correto: form.pontos_resultado_correto,
        pontos_classificado_mata_mata: form.pontos_classificado_mata_mata,
        pontos_marcador_brasil: form.pontos_marcador_brasil,
        pontos_marcador_brasil_com_quantidade: form.pontos_marcador_brasil_com_quantidade,
      })
      await adminService.updateFases({
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
      error(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSaveResultadoEspecial = async () => {
    setSavingResultado(true)
    try {
      const payload = {
        campeao_id: resultadoForm.campeao_id ? Number(resultadoForm.campeao_id) : null,
        vice_campeao_id: resultadoForm.vice_campeao_id ? Number(resultadoForm.vice_campeao_id) : null,
        terceiro_lugar_id: resultadoForm.terceiro_lugar_id ? Number(resultadoForm.terceiro_lugar_id) : null,
        artilheiro_pais_id: resultadoForm.artilheiro_pais_id ? Number(resultadoForm.artilheiro_pais_id) : null,
        finalizado: resultadoEspecial?.finalizado ?? false,
      }
      await adminService.saveResultadoEspecial(payload, !!resultadoEspecial)
      await queryClient.invalidateQueries({ queryKey: ['resultados-especiais', 'admin'] })
      success('Resultado de especiais salvo')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar resultado de especiais')
    } finally {
      setSavingResultado(false)
    }
  }

  const handleFinalizarResultadoEspecial = async () => {
    try {
      await adminService.finalizarResultadoEspecial()
      await queryClient.invalidateQueries({ queryKey: ['resultados-especiais', 'admin'] })
      success('Resultado de especiais finalizado')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao finalizar especiais')
    }
  }

  return (
    <div className="space-y-4">
      {/* Info bloqueio */}
      <div className="glass rounded-2xl p-4">
        <p className="font-semibold text-sm">Palpites especiais</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          O bloqueio efetivo é calculado pela data de bloqueio da configuração do bolão.
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Data de bloqueio atual:{' '}
          {config?.data_bloqueio_palpites_especiais
            ? formatDate(config.data_bloqueio_palpites_especiais)
            : 'Automática (1h antes do primeiro jogo, horário de Brasília)'}
        </p>
      </div>

      {/* Resultado oficial */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <p className="font-semibold text-sm">Resultado oficial de especiais</p>
        <div className="grid grid-cols-2 gap-2">
          <SelectInput
            value={resultadoForm.campeao_id}
            onChange={(value) => setResultadoForm((old) => ({ ...old, campeao_id: value }))}
            options={paisOptions}
            placeholder="Campeão"
          />
          <SelectInput
            value={resultadoForm.vice_campeao_id}
            onChange={(value) => setResultadoForm((old) => ({ ...old, vice_campeao_id: value }))}
            options={paisOptions}
            placeholder="Vice-campeão"
          />
          <SelectInput
            value={resultadoForm.terceiro_lugar_id}
            onChange={(value) => setResultadoForm((old) => ({ ...old, terceiro_lugar_id: value }))}
            options={paisOptions}
            placeholder="3º lugar"
          />
          <SelectInput
            value={resultadoForm.artilheiro_pais_id}
            onChange={(value) => setResultadoForm((old) => ({ ...old, artilheiro_pais_id: value }))}
            options={paisOptions}
            placeholder="País do artilheiro"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSaveResultadoEspecial}
            disabled={savingResultado}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--highlight-dim)', border: '1px solid rgba(246,198,91,0.3)', color: 'var(--highlight)' }}
          >
            {savingResultado ? 'Salvando…' : 'Salvar resultado'}
          </button>
          <button
            onClick={handleFinalizarResultadoEspecial}
            disabled={resultadoEspecial?.finalizado}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: 'rgba(53,208,127,0.16)', border: '1px solid rgba(53,208,127,0.35)', color: 'var(--accent)' }}
          >
            {resultadoEspecial?.finalizado ? 'Especiais finalizado' : 'Finalizar especiais'}
          </button>
        </div>
      </div>

      {/* Configuração de pontuação */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <p className="font-semibold text-sm">Configuração de pontuação</p>

        <div>
          <label
            htmlFor="bloqueio-especiais"
            className="block text-xs font-bold mb-2 uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Bloqueio de especiais
          </label>
          <input
            id="bloqueio-especiais"
            type="datetime-local"
            value={(form?.data_bloqueio_palpites_especiais || '').slice(0, 16)}
            onChange={(e) =>
              setForm((old) =>
                old
                  ? { ...old, data_bloqueio_palpites_especiais: e.target.value ? new Date(e.target.value).toISOString() : null }
                  : old,
              )
            }
            className="w-full px-3 py-3 rounded-xl text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PONTUACAO_CONFIG_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label
                htmlFor={`config-${key}`}
                className="block text-xs mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {label}
              </label>
              <input
                id={`config-${key}`}
                type="number"
                min={0}
                value={form ? form[key] : 0}
                onChange={(e) =>
                  setForm((old) => (old ? { ...old, [key]: parseInt(e.target.value) || 0 } : old))
                }
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
          <div className="grid grid-cols-12 gap-1 mb-1">
            <span className="col-span-5 text-xs" style={{ color: 'var(--text-muted)' }} />
            <span className="col-span-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Exato</span>
            <span className="col-span-2 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Res.</span>
            <span className="col-span-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>Class.</span>
          </div>
          {fases.map((f) => (
            <div key={f.fase_key} className="grid grid-cols-12 gap-1 items-center">
              <p className="col-span-5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>{f.label}</p>
              <input
                type="number"
                min={0}
                aria-label={`${f.label} - placar exato`}
                value={f.pontos_placar_exato}
                onChange={(e) =>
                  setFases((old) =>
                    old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_placar_exato: parseInt(e.target.value) || 0 } : x),
                  )
                }
                className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
              />
              <input
                type="number"
                min={0}
                aria-label={`${f.label} - resultado correto`}
                value={f.pontos_resultado_correto}
                onChange={(e) =>
                  setFases((old) =>
                    old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_resultado_correto: parseInt(e.target.value) || 0 } : x),
                  )
                }
                className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
              />
              <input
                type="number"
                min={0}
                aria-label={`${f.label} - classificado mata-mata`}
                value={f.pontos_classificado_mata_mata}
                onChange={(e) =>
                  setFases((old) =>
                    old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_classificado_mata_mata: parseInt(e.target.value) || 0 } : x),
                  )
                }
                className="col-span-3 px-2 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)' }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSaveConfiguracao}
          disabled={savingConfig}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#070A12' }}
        >
          {savingConfig ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  )
}
