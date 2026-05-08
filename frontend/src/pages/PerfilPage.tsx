import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, Building2, Eye, EyeOff, CheckCircle2, Save } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { perfilService } from '@/services/perfil.service'
import { ApiError } from '@/lib/api'
import { imgUrl } from '@/lib/utils'

export function PerfilPage() {
  const { user, refreshUser } = useAuth()
  const [nome, setNome] = useState(user?.nome ?? '')
  const [funcao, setFuncao] = useState(user?.funcao ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? user?.imagem_perfil ?? '')
  const [perfilSaved, setPerfilSaved] = useState(false)
  const [perfilError, setPerfilError] = useState<string | null>(null)

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [senhaSaved, setSenhaSaved] = useState(false)
  const [senhaError, setSenhaError] = useState<string | null>(null)

  const updatePerfilMutation = useMutation({
    mutationFn: () => perfilService.updatePerfil({ nome, funcao: funcao || undefined, avatar_url: avatarUrl || undefined }),
    onSuccess: async () => {
      await refreshUser()
      setPerfilSaved(true)
      setPerfilError(null)
      setTimeout(() => setPerfilSaved(false), 2000)
    },
    onError: (err) => {
      setPerfilError(err instanceof ApiError ? err.message : 'Erro ao salvar perfil')
    },
  })

  const alterarSenhaMutation = useMutation({
    mutationFn: () => perfilService.alterarSenha(senhaAtual, novaSenha, confirmarSenha),
    onSuccess: () => {
      setSenhaSaved(true)
      setSenhaError(null)
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
      setTimeout(() => setSenhaSaved(false), 2000)
    },
    onError: (err) => {
      setSenhaError(err instanceof ApiError ? err.message : 'Erro ao alterar senha')
    },
  })

  const avatarSrc = avatarUrl || user?.avatar_url || user?.imagem_perfil

  return (
    <div className="pb-24 pt-2 flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Meu Perfil
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Gerencie suas informações pessoais
        </p>
      </div>

      {/* Avatar preview */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{ background: 'var(--glass)', border: '2px solid var(--border)' }}
        >
          {avatarSrc ? (
            <img src={imgUrl(avatarSrc)} alt={user?.nome} className="w-full h-full object-cover" />
          ) : (
            <User size={28} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <div>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>
            {user?.nome}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {user?.email}
          </p>
        </div>
      </div>

      {/* Empresa */}
      {user?.empresa_id && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
        >
          <Building2 size={18} style={{ color: 'var(--accent)' }} />
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Empresa
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Empresa #{user.empresa_id}
            </p>
          </div>
        </div>
      )}

      {/* Formulário de perfil */}
      <section
        className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <User size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Informações pessoais
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Função / Cargo
            </label>
            <input
              type="text"
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              URL da foto de perfil
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
        </div>

        {perfilError && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {perfilError}
          </p>
        )}

        <motion.button
          onClick={() => updatePerfilMutation.mutate()}
          disabled={updatePerfilMutation.isPending}
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {perfilSaved ? (
            <>
              <CheckCircle2 size={15} />
              Salvo!
            </>
          ) : (
            <>
              <Save size={15} />
              {updatePerfilMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </>
          )}
        </motion.button>
      </section>

      {/* Alterar senha */}
      <section
        className="rounded-2xl p-4 flex flex-col gap-4"
        style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Lock size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Alterar senha
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {[
            { label: 'Senha atual', value: senhaAtual, setter: setSenhaAtual },
            { label: 'Nova senha', value: novaSenha, setter: setNovaSenha },
            { label: 'Confirmar nova senha', value: confirmarSenha, setter: setConfirmarSenha },
          ].map(({ label, value, setter }) => (
            <div key={label} className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {label}
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ border: '1px solid var(--border)' }}
              >
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showSenha ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {senhaError && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {senhaError}
          </p>
        )}

        <motion.button
          onClick={() => alterarSenhaMutation.mutate()}
          disabled={alterarSenhaMutation.isPending || !senhaAtual || !novaSenha || !confirmarSenha}
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
          style={{ background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {senhaSaved ? (
            <>
              <CheckCircle2 size={15} style={{ color: 'var(--accent)' }} />
              Senha alterada!
            </>
          ) : (
            alterarSenhaMutation.isPending ? 'Salvando…' : 'Alterar senha'
          )}
        </motion.button>
      </section>
    </div>
  )
}
