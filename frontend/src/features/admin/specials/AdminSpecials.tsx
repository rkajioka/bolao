import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SelectInput } from '@/components/SelectInput'
import type { ConfiguracaoBolao, PontuacaoFase } from '@/types'
import { formatDate, mensagemPodioRepetidoEspeciais } from '@/lib/utils'
import { adminService } from '@/services/admin.service'

interface AdminSpecialsProps {
  success: (msg: string) => void
  error: (msg: string) => void
  variant: 'scoring' | 'results'
  /** Obrigatório quando variant === scoring (tenant). */
  empresaId?: number
}

const PONTUACAO_CONFIG_FIELDS: { key: keyof Pick<ConfiguracaoBolao,
  'pontos_campeao' | 'pontos_vice_campeao' | 'pontos_terceiro_lugar' | 'pontos_artilheiro_pais'
>; label: string }[] = [
  { key: 'pontos_campeao', label: 'Campeão' },
  { key: 'pontos_vice_campeao', label: 'Vice' },
  { key: 'pontos_terceiro_lugar', label: '3º lugar' },
  { key: 'pontos_artilheiro_pais', label: 'País do artilheiro' },
]

const scoringFieldStyle = {
  background: 'var(--segmented-active-bg)',
  border: '1px solid var(--border-hover)',
  color: 'var(--text)',
} as const

const scoringInputClassName =
  'w-full min-h-10 rounded-xl px-3 py-2 text-sm font-semibold tabular-nums outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)]'

const phaseInputClassName =
  'w-full min-h-9 rounded-lg px-2 py-1.5 text-sm font-semibold tabular-nums text-center outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)]'

const FASES_SEM_PONTOS_CLASSIFICADO = new Set([
  'grupo_rodada_1',
  'grupo_rodada_2',
  'grupo_rodada_3',
])

export function AdminSpecials({ success, error, variant, empresaId }: AdminSpecialsProps) {
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

  const scoringEnabled = variant === 'scoring' && empresaId != null

  const {
    data: config,
    isLoading: loadConfig,
    isError: errConfig,
  } = useQuery({
    queryKey: ['configuracao-bolao', variant, empresaId],
    queryFn: () => adminService.getConfig(empresaId),
    enabled: scoringEnabled,
  })
  const {
    data: fasesData = [],
    isLoading: loadFases,
    isError: errFases,
    isFetching: fetchingFases,
  } = useQuery({
    queryKey: ['configuracao-pontuacao-fase', variant, empresaId],
    queryFn: () => adminService.getFases(empresaId),
    enabled: scoringEnabled,
  })
  const { data: paises = [] } = useQuery({
    queryKey: ['paises'],
    queryFn: () => adminService.getPaises(),
    enabled: variant === 'results',
  })
  const { data: resultadoEspecial } = useQuery({
    queryKey: ['resultados-especiais', 'admin'],
    queryFn: () => adminService.getResultadoEspecial(),
    enabled: variant === 'results',
  })

  useEffect(() => {
    if (!config) return
    setForm(config)
  }, [config])

  useEffect(() => {
    setFases(fasesData)
  }, [fasesData])

  useEffect(() => {
    if (!resultadoEspecial) return
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

  const resultadoPaisOptions = useMemo(() => {
    const filtrarPodio = (atual: string, outros: string[]) =>
      paisOptions.filter(
        (option) => !outros.includes(option.value) || option.value === atual,
      )

    return {
      campeao: filtrarPodio(resultadoForm.campeao_id, [
        resultadoForm.vice_campeao_id,
        resultadoForm.terceiro_lugar_id,
      ]),
      vice: filtrarPodio(resultadoForm.vice_campeao_id, [
        resultadoForm.campeao_id,
        resultadoForm.terceiro_lugar_id,
      ]),
      terceiro: filtrarPodio(resultadoForm.terceiro_lugar_id, [
        resultadoForm.campeao_id,
        resultadoForm.vice_campeao_id,
      ]),
      artilheiro: paisOptions,
    }
  }, [paisOptions, resultadoForm])

  const marcadoresBrasilHabilitado = Boolean(form?.marcadores_brasil_habilitado)
  const bloqueioEspeciaisTravado = config?.data_bloqueio_palpites_especiais != null
  const resultadoEspecialFinalizado = Boolean(resultadoEspecial?.finalizado)

  const handleSaveConfiguracao = async () => {
    if (!form || empresaId == null) return
    setSavingConfig(true)
    try {
      const payload: Parameters<typeof adminService.updateConfig>[0] = {
        data_bloqueio_palpites_especiais: bloqueioEspeciaisTravado
          ? config?.data_bloqueio_palpites_especiais ?? form.data_bloqueio_palpites_especiais
          : form.data_bloqueio_palpites_especiais,
        pontos_campeao: form.pontos_campeao,
        pontos_vice_campeao: form.pontos_vice_campeao,
        pontos_terceiro_lugar: form.pontos_terceiro_lugar,
        pontos_artilheiro_pais: form.pontos_artilheiro_pais,
        pontos_placar_exato: form.pontos_placar_exato,
        pontos_resultado_correto: form.pontos_resultado_correto,
        pontos_classificado_mata_mata: form.pontos_classificado_mata_mata,
        pontos_marcador_brasil: form.pontos_marcador_brasil,
        pontos_marcador_brasil_com_quantidade: form.pontos_marcador_brasil_com_quantidade,
      }
      if (!marcadoresBrasilHabilitado) {
        delete payload.pontos_marcador_brasil
        delete payload.pontos_marcador_brasil_com_quantidade
      }
      await adminService.updateConfig(payload, empresaId)
      await adminService.updateFases(
        {
          itens: fases.map((f) => ({
            fase_key: f.fase_key,
            label: f.label,
            ordem: f.ordem,
            pontos_placar_exato: f.pontos_placar_exato,
            pontos_resultado_correto: f.pontos_resultado_correto,
            pontos_classificado_mata_mata: f.pontos_classificado_mata_mata,
          })),
        },
        empresaId,
      )
      await queryClient.invalidateQueries({ queryKey: ['configuracao-bolao', variant, empresaId] })
      await queryClient.invalidateQueries({ queryKey: ['configuracao-pontuacao-fase', variant, empresaId] })
      await queryClient.invalidateQueries({ queryKey: ['configuracao-bolao', 'minha'] })
      await queryClient.invalidateQueries({ queryKey: ['configuracao-pontuacao-fase', 'minha'] })
      success('Configuração salva')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSaveResultadoEspecial = async () => {
    if (resultadoEspecialFinalizado) {
      error('O resultado de especiais está finalizado e não pode ser alterado.')
      return
    }
    const podioRepetido = mensagemPodioRepetidoEspeciais(
      resultadoForm.campeao_id,
      resultadoForm.vice_campeao_id,
      resultadoForm.terceiro_lugar_id,
    )
    if (podioRepetido) {
      error(podioRepetido)
      return
    }
    setSavingResultado(true)
    try {
      const payload = {
        campeao_id: resultadoForm.campeao_id ? Number(resultadoForm.campeao_id) : null,
        vice_campeao_id: resultadoForm.vice_campeao_id ? Number(resultadoForm.vice_campeao_id) : null,
        terceiro_lugar_id: resultadoForm.terceiro_lugar_id ? Number(resultadoForm.terceiro_lugar_id) : null,
        artilheiro_pais_id: resultadoForm.artilheiro_pais_id ? Number(resultadoForm.artilheiro_pais_id) : null,
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

  if (variant === 'scoring' && empresaId == null) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Selecione uma empresa para editar a pontuação.
      </p>
    )
  }

  const fasesProntas = !loadFases && !fetchingFases && !errFases && fases.length > 0
  const podeSalvarConfig = Boolean(form) && fasesProntas && !loadConfig && !errConfig

  if (variant === 'results') {
    return (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-4">
          <p className="font-semibold text-sm">Palpites especiais</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            O bloqueio efetivo é calculado pela data de bloqueio da configuração do bolão em cada empresa.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Resultado oficial abaixo é único na plataforma (torneio).
          </p>
        </div>

        <div className="glass rounded-2xl p-5 space-y-4">
          <p className="font-semibold text-sm">Resultado oficial de especiais</p>
          <div className="grid grid-cols-2 gap-2">
            <SelectInput
              value={resultadoForm.campeao_id}
              onChange={(value) => setResultadoForm((old) => ({ ...old, campeao_id: value }))}
              options={resultadoPaisOptions.campeao}
              placeholder="Campeão"
              disabled={resultadoEspecialFinalizado}
            />
            <SelectInput
              value={resultadoForm.vice_campeao_id}
              onChange={(value) => setResultadoForm((old) => ({ ...old, vice_campeao_id: value }))}
              options={resultadoPaisOptions.vice}
              placeholder="Vice-campeão"
              disabled={resultadoEspecialFinalizado}
            />
            <SelectInput
              value={resultadoForm.terceiro_lugar_id}
              onChange={(value) => setResultadoForm((old) => ({ ...old, terceiro_lugar_id: value }))}
              options={resultadoPaisOptions.terceiro}
              placeholder="3º lugar"
              disabled={resultadoEspecialFinalizado}
            />
            <SelectInput
              value={resultadoForm.artilheiro_pais_id}
              onChange={(value) => setResultadoForm((old) => ({ ...old, artilheiro_pais_id: value }))}
              options={resultadoPaisOptions.artilheiro}
              placeholder="País do artilheiro"
              disabled={resultadoEspecialFinalizado}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleSaveResultadoEspecial()}
              disabled={savingResultado || resultadoEspecialFinalizado}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--highlight-dim)', border: '1px solid rgba(246,198,91,0.3)', color: 'var(--highlight)' }}
            >
              {savingResultado ? 'Salvando…' : 'Salvar resultado'}
            </button>
            <button
              type="button"
              onClick={() => void handleFinalizarResultadoEspecial()}
              disabled={resultadoEspecial?.finalizado}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'rgba(53,208,127,0.16)', border: '1px solid rgba(53,208,127,0.35)', color: 'var(--accent)' }}
            >
              {resultadoEspecial?.finalizado ? 'Especiais finalizado' : 'Finalizar especiais'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
            disabled={bloqueioEspeciaisTravado}
            className={`${scoringInputClassName} text-left disabled:opacity-60 disabled:cursor-not-allowed`}
            style={scoringFieldStyle}
          />
          {bloqueioEspeciaisTravado && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Após definida, a data de bloqueio não pode ser alterada.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Palpites especiais
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Informe quantos pontos vale cada acerto nos palpites especiais.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PONTUACAO_CONFIG_FIELDS.map(({ key, label }) => (
              <div
                key={key}
                className="rounded-xl p-3 space-y-2"
                style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}
              >
                <label
                  htmlFor={`config-${key}`}
                  className="block text-xs font-semibold"
                  style={{ color: 'var(--text)' }}
                >
                  {label}
                </label>
                <input
                  id={`config-${key}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form ? form[key] : 0}
                  onChange={(e) =>
                    setForm((old) => (old ? { ...old, [key]: parseInt(e.target.value) || 0 } : old))
                  }
                  className={`${scoringInputClassName} text-center`}
                  style={scoringFieldStyle}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Pontuação por fase
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Ajuste os pontos de placar exato, resultado e classificado em cada fase do torneio.
            </p>
          </div>
          {(loadFases || fetchingFases) && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Carregando pontuação por fase…
            </p>
          )}
          {errFases && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>
              Não foi possível carregar a pontuação por fase. Verifique a conexão com o servidor.
            </p>
          )}
          {!loadFases && !fetchingFases && !errFases && fases.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Nenhuma fase configurada.
            </p>
          )}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border-hover)' }}
          >
            <div
              className="grid grid-cols-12 gap-2 px-3 py-2.5"
              style={{ background: 'var(--segmented-bg)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="col-span-5 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Fase
              </span>
              <span className="col-span-2 text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--highlight)' }}>
                Exato
              </span>
              <span className="col-span-2 text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--accent)' }}>
                Res.
              </span>
              <span className="col-span-3 text-[10px] font-bold uppercase tracking-wide text-center" style={{ color: 'var(--text-muted)' }}>
                Class.
              </span>
            </div>
            {fases.map((f, index) => (
              <div
                key={f.fase_key}
                className="grid grid-cols-12 gap-2 items-center px-3 py-2.5"
                style={{
                  borderBottom: index < fases.length - 1 ? '1px solid var(--border)' : 'none',
                  background: index % 2 === 0 ? 'var(--segmented-active-bg)' : 'var(--segmented-bg)',
                }}
              >
                <p className="col-span-5 text-xs font-medium truncate pr-1" style={{ color: 'var(--text)' }}>
                  {f.label}
                </p>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  aria-label={`${f.label} - placar exato`}
                  value={f.pontos_placar_exato}
                  onChange={(e) =>
                    setFases((old) =>
                      old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_placar_exato: parseInt(e.target.value) || 0 } : x),
                    )
                  }
                  className={`col-span-2 ${phaseInputClassName}`}
                  style={scoringFieldStyle}
                />
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  aria-label={`${f.label} - resultado correto`}
                  value={f.pontos_resultado_correto}
                  onChange={(e) =>
                    setFases((old) =>
                      old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_resultado_correto: parseInt(e.target.value) || 0 } : x),
                    )
                  }
                  className={`col-span-2 ${phaseInputClassName}`}
                  style={scoringFieldStyle}
                />
                {FASES_SEM_PONTOS_CLASSIFICADO.has(f.fase_key) ? (
                  <span
                    className="col-span-3 text-sm font-semibold text-center tabular-nums"
                    style={{ color: 'var(--text-muted)' }}
                    aria-hidden="true"
                  >
                    -
                  </span>
                ) : (
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    aria-label={`${f.label} - classificado mata-mata`}
                    value={f.pontos_classificado_mata_mata}
                    onChange={(e) =>
                      setFases((old) =>
                        old.map((x) => x.fase_key === f.fase_key ? { ...x, pontos_classificado_mata_mata: parseInt(e.target.value) || 0 } : x),
                      )
                    }
                    className={`col-span-3 ${phaseInputClassName}`}
                    style={scoringFieldStyle}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {marcadoresBrasilHabilitado && (
          <div className="space-y-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Bônus Brasil
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Pontos por acerto nos marcadores da seleção nos jogos do Brasil.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: 'pontos_marcador_brasil', label: 'Por marcador' },
                  { key: 'pontos_marcador_brasil_com_quantidade', label: 'Com quantidade de gols' },
                ] as const
              ).map(({ key, label }) => (
                <div
                  key={key}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}
                >
                  <label htmlFor={`config-${key}`} className="block text-xs font-semibold" style={{ color: 'var(--text)' }}>
                    {label}
                  </label>
                  <input
                    id={`config-${key}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form ? form[key] : 0}
                    onChange={(e) =>
                      setForm((old) => (old ? { ...old, [key]: parseInt(e.target.value) || 0 } : old))
                    }
                    className={`${scoringInputClassName} text-center`}
                    style={scoringFieldStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSaveConfiguracao()}
          disabled={savingConfig || !podeSalvarConfig}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#070A12' }}
        >
          {savingConfig ? 'Salvando…' : 'Salvar configuração'}
        </button>
      </div>
    </div>
  )
}
