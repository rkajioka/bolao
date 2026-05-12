import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, ChevronDown } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { empresaService } from '@/services/empresa.service'
import type { Empresa } from '@/types'

interface AdminEmpresasProps {
  success: (msg: string) => void
  error: (msg: string) => void
}

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--text)',
} as const

type FiltroEmpresa = 'todos' | 'ativas' | 'inativas' | 'bonus_br'

function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function empresaAtendeBusca(empresa: Empresa, query: string): boolean {
  const tokens = normalizarBusca(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const corpus = normalizarBusca(
    [
      empresa.nome,
      empresa.codigo_empresa,
      empresa.ativo ? 'ativa ativo' : 'inativa inativo',
      empresa.marcadores_brasil_habilitado
        ? 'marcadores brasil bonus br ativo ligado'
        : 'marcadores brasil bonus br inativo desligado',
      String(empresa.max_usuarios),
      String(empresa.total_usuarios),
      String(empresa.convites_pendentes),
      String(empresa.vagas_restantes),
    ].join(' '),
  )

  return tokens.every((token) => corpus.includes(token))
}

function empresaAtendeFiltro(empresa: Empresa, filtro: FiltroEmpresa): boolean {
  if (filtro === 'ativas') return empresa.ativo
  if (filtro === 'inativas') return !empresa.ativo
  if (filtro === 'bonus_br') return empresa.marcadores_brasil_habilitado
  return true
}

export function AdminEmpresas({ success, error }: AdminEmpresasProps) {
  const queryClient = useQueryClient()
  const [nome, setNome] = useState('')
  const [maxUsuarios, setMaxUsuarios] = useState('50')
  const [marcadoresBrasilHabilitado, setMarcadoresBrasilHabilitado] = useState(false)

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas', 'owner'],
    queryFn: () => empresaService.listar(),
  })

  const criar = useMutation({
    mutationFn: () =>
      empresaService.criar({
        nome: nome.trim(),
        max_usuarios: Number(maxUsuarios),
        marcadores_brasil_habilitado: marcadoresBrasilHabilitado,
      }),
    onSuccess: async (empresa) => {
      setNome('')
      setMaxUsuarios('50')
      setMarcadoresBrasilHabilitado(false)
      await queryClient.invalidateQueries({ queryKey: ['empresas', 'owner'] })
      success(
        `Empresa criada com o código ${empresa.codigo_empresa}. Cadastre o administrador em Usuários com a empresa vinculada.`,
      )
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao criar empresa')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      error('Informe o nome da empresa.')
      return
    }
    const limite = Number(maxUsuarios)
    if (!Number.isInteger(limite) || limite < 1) {
      error('Informe um limite máximo de usuários válido.')
      return
    }
    criar.mutate()
  }

  if (isLoading) {
    return (
      <div className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
        Carregando…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 size={16} style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-semibold">Nova empresa</p>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          O código da empresa é gerado automaticamente. Após criar, cadastre o administrador em Usuários com o
          papel admin e a empresa escolhida.
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
            maxLength={255}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            Máximo de usuários
          </span>
          <input
            type="number"
            min={1}
            value={maxUsuarios}
            onChange={(e) => setMaxUsuarios(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
            required
          />
        </label>
        <label
          className="flex items-start gap-3 rounded-xl p-3 cursor-pointer"
          style={{ background: 'var(--segmented-bg)', border: '1px solid var(--border)' }}
        >
          <input
            type="checkbox"
            checked={marcadoresBrasilHabilitado}
            onChange={(e) => setMarcadoresBrasilHabilitado(e.target.checked)}
            className="mt-0.5"
          />
          <span className="space-y-1">
            <span className="block text-sm font-semibold">Bônus por marcadores do Brasil</span>
            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
              A lista de jogadores candidatos é global (Torneio → Jogos). Com o bônus ativo, o admin da empresa
              define os pontos na configuração de pontuação.
            </span>
          </span>
        </label>
        <button
          type="submit"
          disabled={criar.isPending}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid rgba(53,208,127,0.35)',
            color: 'var(--accent)',
            opacity: criar.isPending ? 0.6 : 1,
          }}
        >
          {criar.isPending ? 'Criando…' : 'Criar empresa'}
        </button>
      </form>

      <EmpresasList empresas={empresas} success={success} error={error} />
    </div>
  )
}

function EmpresasList({
  empresas,
  success,
  error,
}: {
  empresas: Empresa[]
  success: (msg: string) => void
  error: (msg: string) => void
}) {
  const queryClient = useQueryClient()
  const [listaAberta, setListaAberta] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroEmpresa>('todos')
  const [marcadoresPendente, setMarcadoresPendente] = useState<{
    id: number
    nome: string
    habilitado: boolean
  } | null>(null)
  const [maxUsuariosEdicao, setMaxUsuariosEdicao] = useState<Record<number, string>>({})

  const empresasFiltradas = useMemo(
    () => empresas.filter((empresa) => empresaAtendeFiltro(empresa, filtro) && empresaAtendeBusca(empresa, busca)),
    [empresas, busca, filtro],
  )

  const atualizarLimite = useMutation({
    mutationFn: ({ id, max_usuarios }: { id: number; max_usuarios: number }) =>
      empresaService.atualizar(id, { max_usuarios }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['empresas', 'owner'] })
      success('Limite de usuários atualizado.')
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao atualizar limite de usuários')
    },
  })

  const atualizarMarcadores = useMutation({
    mutationFn: ({ id, habilitado }: { id: number; habilitado: boolean }) =>
      empresaService.atualizar(id, { marcadores_brasil_habilitado: habilitado }),
    onSuccess: async (_empresa, { habilitado }) => {
      setMarcadoresPendente(null)
      await queryClient.invalidateQueries({ queryKey: ['empresas', 'owner'] })
      await queryClient.invalidateQueries({ queryKey: ['configuracao-bolao'] })
      success(
        habilitado
          ? 'Bônus de marcadores do Brasil ativado para a empresa.'
          : 'Bônus de marcadores do Brasil desativado. O ranking será recalculado sem esse bônus.',
      )
    },
    onError: (err) => {
      error(err instanceof Error ? err.message : 'Erro ao atualizar empresa')
    },
  })

  const pendenteAtivar = marcadoresPendente?.habilitado === true

  return (
    <>
      <ConfirmDialog
        open={marcadoresPendente !== null}
        title={pendenteAtivar ? 'Ativar bônus de marcadores?' : 'Desativar bônus de marcadores?'}
        description={
          marcadoresPendente
            ? pendenteAtivar
              ? `Em ${marcadoresPendente.nome}, participantes poderão palpitar marcadores do Brasil. A lista de jogadores é global; o admin da empresa define os pontos na configuração de pontuação.`
              : `Em ${marcadoresPendente.nome}, o ranking será recalculado sem pontos de marcadores do Brasil. Palpites antigos permanecem salvos, mas deixam de valer até você reativar o bônus.`
            : ''
        }
        confirmLabel={pendenteAtivar ? 'Ativar bônus' : 'Desativar bônus'}
        tone={pendenteAtivar ? 'default' : 'warning'}
        confirming={atualizarMarcadores.isPending}
        onCancel={() => {
          if (!atualizarMarcadores.isPending) setMarcadoresPendente(null)
        }}
        onConfirm={() => {
          if (!marcadoresPendente) return
          atualizarMarcadores.mutate({
            id: marcadoresPendente.id,
            habilitado: marcadoresPendente.habilitado,
          })
        }}
      />

      <div className="glass rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setListaAberta((aberta) => !aberta)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
          style={{ background: 'rgba(255,255,255,0.03)', border: 'none', color: 'var(--text)' }}
          aria-expanded={listaAberta}
        >
          <span className="text-sm font-semibold">Empresas cadastradas ({empresas.length})</span>
          <ChevronDown
            size={18}
            className="shrink-0 transition-transform duration-200"
            style={{
              transform: listaAberta ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--text-muted)',
            }}
          />
        </button>

        <AnimatePresence initial={false}>
          {listaAberta && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-4 pt-3 space-y-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Cadastradas ({empresas.length})
                    {empresasFiltradas.length !== empresas.length && (
                      <span> — exibindo {empresasFiltradas.length}</span>
                    )}
                  </p>
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, código, status, uso ou bônus BR…"
                    aria-label="Buscar empresas"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={inputStyle}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { key: 'todos' as const, label: 'Todas' },
                        { key: 'ativas' as const, label: 'Ativas' },
                        { key: 'inativas' as const, label: 'Inativas' },
                        { key: 'bonus_br' as const, label: 'Com bônus BR' },
                      ] as const
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFiltro(key)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                        style={{
                          background: filtro === key ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${filtro === key ? 'var(--accent)' : 'rgba(255,255,255,0.10)'}`,
                          color: filtro === key ? '#070A12' : 'var(--text-muted)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-xl overflow-y-auto max-h-[min(28rem,60vh)] space-y-2 pr-1"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  role="list"
                  aria-label="Empresas cadastradas"
                >
                  {empresas.length === 0 ? (
                    <p className="text-sm py-6 px-3 text-center" style={{ color: 'var(--text-muted)' }}>
                      Nenhuma empresa cadastrada ainda.
                    </p>
                  ) : empresasFiltradas.length === 0 ? (
                    <p className="text-sm py-6 px-3 text-center" style={{ color: 'var(--text-muted)' }}>
                      Nenhum resultado para essa busca ou filtro.
                    </p>
                  ) : (
                    empresasFiltradas.map((empresa) => (
                      <EmpresaListItem
                        key={empresa.id}
                        empresa={empresa}
                        maxUsuariosEdicao={maxUsuariosEdicao[empresa.id] ?? String(empresa.max_usuarios)}
                        onMaxUsuariosChange={(valor) =>
                          setMaxUsuariosEdicao((current) => ({ ...current, [empresa.id]: valor }))
                        }
                        onSalvarLimite={() => {
                          const valor = Number(maxUsuariosEdicao[empresa.id] ?? empresa.max_usuarios)
                          if (!Number.isInteger(valor) || valor < 1) {
                            error('Informe um limite máximo de usuários válido.')
                            return
                          }
                          atualizarLimite.mutate({ id: empresa.id, max_usuarios: valor })
                        }}
                        onToggleMarcadores={() =>
                          setMarcadoresPendente({
                            id: empresa.id,
                            nome: empresa.nome,
                            habilitado: !empresa.marcadores_brasil_habilitado,
                          })
                        }
                        salvandoLimite={atualizarLimite.isPending}
                        salvandoMarcadores={atualizarMarcadores.isPending}
                      />
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

function EmpresaListItem({
  empresa,
  maxUsuariosEdicao,
  onMaxUsuariosChange,
  onSalvarLimite,
  onToggleMarcadores,
  salvandoLimite,
  salvandoMarcadores,
}: {
  empresa: Empresa
  maxUsuariosEdicao: string
  onMaxUsuariosChange: (valor: string) => void
  onSalvarLimite: () => void
  onToggleMarcadores: () => void
  salvandoLimite: boolean
  salvandoMarcadores: boolean
}) {
  const [aberta, setAberta] = useState(false)
  const usoTotal = empresa.total_usuarios + empresa.convites_pendentes

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      role="listitem"
    >
      <button
        type="button"
        onClick={() => setAberta((atual) => !atual)}
        className="w-full px-3 py-3 text-left"
        aria-expanded={aberta}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-sm truncate">{empresa.nome}</p>
              <StatusBadge ativo={empresa.ativo} />
              <MarcadoresBadge ativo={empresa.marcadores_brasil_habilitado} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Código <span className="font-mono">{empresa.codigo_empresa}</span>
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Uso: {usoTotal}/{empresa.max_usuarios} usuários
              {empresa.convites_pendentes > 0
                ? ` · ${empresa.convites_pendentes} convite(s) pendente(s)`
                : ''}
              {empresa.vagas_restantes > 0 ? ` · ${empresa.vagas_restantes} vaga(s) restante(s)` : ''}
            </p>
          </div>
          <ChevronDown
            size={18}
            className="shrink-0 mt-0.5 transition-transform duration-200"
            style={{
              transform: aberta ? 'rotate(180deg)' : 'rotate(0deg)',
              color: 'var(--text-muted)',
            }}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3 pt-1 grid gap-3 sm:grid-cols-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <section className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Limite de participantes
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {empresa.total_usuarios} ativo(s), {empresa.convites_pendentes} convite(s) pendente(s) e{' '}
                  {empresa.vagas_restantes} vaga(s) disponível(is).
                </p>
                <label className="block space-y-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Máximo de usuários
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={maxUsuariosEdicao}
                    onChange={(e) => onMaxUsuariosChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={inputStyle}
                  />
                </label>
                <button
                  type="button"
                  disabled={salvandoLimite}
                  onClick={onSalvarLimite}
                  className="w-full py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'var(--text)',
                  }}
                >
                  Salvar limite
                </button>
              </section>

              <section className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Bônus por marcadores do Brasil
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {empresa.marcadores_brasil_habilitado
                    ? 'Participantes desta empresa podem palpitar marcadores do Brasil. O admin define os pontos na configuração de pontuação.'
                    : 'O bônus está desligado para esta empresa. Ative para liberar palpites e pontuação de marcadores.'}
                </p>
                <button
                  type="button"
                  disabled={salvandoMarcadores}
                  onClick={onToggleMarcadores}
                  className="w-full py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{
                    background: empresa.marcadores_brasil_habilitado
                      ? 'rgba(255,92,122,0.10)'
                      : 'rgba(53,208,127,0.12)',
                    border: `1px solid ${
                      empresa.marcadores_brasil_habilitado ? 'rgba(255,92,122,0.25)' : 'rgba(53,208,127,0.25)'
                    }`,
                    color: empresa.marcadores_brasil_habilitado ? 'var(--danger)' : 'var(--accent)',
                  }}
                >
                  {empresa.marcadores_brasil_habilitado ? 'Desligar bônus BR' : 'Ligar bônus BR'}
                </button>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
      style={{
        background: ativo ? 'var(--accent-dim)' : 'var(--danger-dim)',
        color: ativo ? 'var(--accent)' : 'var(--danger)',
        border: `1px solid ${ativo ? 'rgba(53,208,127,0.3)' : 'rgba(255,92,122,0.3)'}`,
      }}
    >
      {ativo ? 'Ativa' : 'Inativa'}
    </span>
  )
}

function MarcadoresBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
      style={{
        background: ativo ? 'rgba(53,208,127,0.12)' : 'rgba(255,255,255,0.06)',
        color: ativo ? 'var(--accent)' : 'var(--text-muted)',
        border: `1px solid ${ativo ? 'rgba(53,208,127,0.25)' : 'rgba(255,255,255,0.10)'}`,
      }}
    >
      BR {ativo ? 'ativo' : 'inativo'}
    </span>
  )
}
