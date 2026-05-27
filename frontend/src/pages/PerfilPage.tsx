import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Lock, Building2, Eye, EyeOff, CheckCircle2, Save, Trash2, ShieldCheck, ChevronRight, Cookie } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { perfilService, PERFIL_AVATAR_MAX_BYTES } from '@/services/perfil.service'
import { ApiError } from '@/lib/api'
import { validarSenhaSegura } from '@/lib/passwordPolicy'
import { UserAvatar } from '@/components/UserAvatar'
import { useCookieConsent } from '@/hooks/useCookieConsent'

const CONSENT_LABEL: Record<string, { text: string; color: string }> = {
  accepted: { text: 'Aceito', color: 'var(--accent)' },
  rejected: { text: 'Rejeitado', color: 'var(--danger)' },
}

export function PerfilPage() {
  const { user, refreshUser } = useAuth()
  const { consent, accept, reject, reset } = useCookieConsent()
  const [nome, setNome] = useState(user?.nome ?? '')
  const [funcao, setFuncao] = useState(user?.funcao ?? '')
  const [perfilSaved, setPerfilSaved] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)
  const [perfilError, setPerfilError] = useState<string | null>(null)

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [senhaSaved, setSenhaSaved] = useState(false)
  const [senhaError, setSenhaError] = useState<string | null>(null)

  const updatePerfilMutation = useMutation({
    mutationFn: () => perfilService.updatePerfil({ nome, funcao: funcao || undefined }),
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

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => perfilService.uploadAvatar(file),
    onSuccess: async () => {
      await refreshUser()
      setPerfilError(null)
      setAvatarSaved(true)
      setTimeout(() => setAvatarSaved(false), 2000)
    },
    onError: (err) => {
      setPerfilError(err instanceof ApiError ? err.message : 'Erro ao enviar foto')
    },
  })

  const removeAvatarMutation = useMutation({
    mutationFn: () => perfilService.removeAvatar(),
    onSuccess: async () => {
      await refreshUser()
      setPerfilError(null)
      setAvatarSaved(true)
      setTimeout(() => setAvatarSaved(false), 2000)
    },
    onError: (err) => {
      setPerfilError(err instanceof ApiError ? err.message : 'Erro ao remover foto')
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

  const avatarSrc = user?.avatar_url || user?.imagem_perfil

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setPerfilError('Use uma imagem JPEG, PNG ou WebP')
      return
    }
    if (file.size > PERFIL_AVATAR_MAX_BYTES) {
      setPerfilError('A foto deve ter no máximo 2 MB')
      return
    }
    setPerfilError(null)
    uploadAvatarMutation.mutate(file)
  }

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
        <UserAvatar
          src={avatarSrc}
          alt={user?.nome ?? ''}
          size="xl"
          rounded="2xl"
          className="flex-shrink-0"
          style={{ background: 'var(--glass)', border: '2px solid var(--border)' }}
        />
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
              Bolão
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {user.empresa_nome ?? 'Bolão'}
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
            <label htmlFor="perfil-nome" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Nome
            </label>
            <input
              id="perfil-nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="perfil-funcao" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Função / Cargo
            </label>
            <input
              id="perfil-funcao"
              type="text"
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="perfil-avatar" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Foto de perfil
            </label>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              JPEG, PNG ou WebP — máximo 2 MB
            </p>
            <input
              id="perfil-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPickAvatar}
              disabled={uploadAvatarMutation.isPending || removeAvatarMutation.isPending}
              className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium"
              style={{ color: 'var(--text)' }}
            />
            {avatarSrc && (
              <button
                type="button"
                onClick={() => removeAvatarMutation.mutate()}
                disabled={removeAvatarMutation.isPending || uploadAvatarMutation.isPending}
                className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 w-fit"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 size={13} />
                {removeAvatarMutation.isPending ? 'Removendo…' : 'Remover foto'}
              </button>
            )}
            {(uploadAvatarMutation.isPending) && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enviando…
              </p>
            )}
            {avatarSaved && (
              <p className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                <CheckCircle2 size={14} />
                Foto atualizada
              </p>
            )}
          </div>
        </div>

        {perfilError && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
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
            { label: 'Senha atual', id: 'perfil-senha-atual', value: senhaAtual, setter: setSenhaAtual },
            { label: 'Nova senha', id: 'perfil-nova-senha', value: novaSenha, setter: setNovaSenha },
            { label: 'Confirmar nova senha', id: 'perfil-confirmar-senha', value: confirmarSenha, setter: setConfirmarSenha },
          ].map(({ label, id, value, setter }) => (
            <div key={label} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {label}
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ border: '1px solid var(--border)' }}
              >
                <input
                  id={id}
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
                  aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showSenha ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {senhaError && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
            {senhaError}
          </p>
        )}

        <motion.button
          onClick={() => {
            const validacao = validarSenhaSegura(novaSenha)
            if (validacao) {
              setSenhaError(validacao)
              return
            }
            if (novaSenha !== confirmarSenha) {
              setSenhaError('A confirmação de senha não confere.')
              return
            }
            setSenhaError(null)
            alterarSenhaMutation.mutate()
          }}
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

      {/* Privacidade */}
      <section
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            Privacidade
          </h2>
        </div>

        {/* Link para a política */}
        <Link
          to="/privacidade"
          className="flex items-center justify-between px-4 py-3 transition-colors duration-150"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              <ShieldCheck size={15} />
            </span>
            <span className="text-sm">Política de Privacidade</span>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </Link>

        {/* Status e gerenciamento de cookies */}
        <div
          className="px-4 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                <Cookie size={15} />
              </span>
              <div>
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  Cookies
                </p>
                <p
                  className="text-xs font-medium"
                  style={{
                    color: consent ? CONSENT_LABEL[consent]?.color : 'var(--text-muted)',
                  }}
                >
                  {consent ? CONSENT_LABEL[consent]?.text : 'Preferência não definida'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {consent !== 'accepted' && (
              <button
                type="button"
                onClick={accept}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{ background: 'var(--accent)', color: '#070A12' }}
              >
                Aceitar
              </button>
            )}
            {consent !== 'rejected' && (
              <button
                type="button"
                onClick={reject}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{
                  background: 'var(--glass)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                Rejeitar
              </button>
            )}
            {consent !== null && (
              <button
                type="button"
                onClick={reset}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{
                  background: 'var(--glass)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                Redefinir
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
