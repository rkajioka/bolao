import { useState, useEffect, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { User, Briefcase, Lock, CheckCircle2 } from 'lucide-react'
import { api, getToken } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { SENHA_PADRAO_TEMPORARIA } from '@/lib/passwordDefaults'
import { validarSenhaSegura } from '@/lib/passwordPolicy'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { perfilService, PERFIL_AVATAR_MAX_BYTES } from '@/services/perfil.service'
import { UserAvatar } from '@/components/UserAvatar'

export function PrimeiroAcessoPage() {
  const { user, refreshUser, isLoading, token } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div
          className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(53,208,127,0.3)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    )
  }
  if (!token) return <Navigate to="/login" replace />
  if (user && !user.primeiro_login) return <Navigate to="/jogos" replace />

  useEffect(() => {
    if (getToken()) void refreshUser()
  }, [refreshUser])

  useEffect(() => {
    if (!user) return
    setForm((prev) => ({
      ...prev,
      nome: prev.nome || user.nome || '',
      funcao: prev.funcao || user.funcao || '',
    }))
  }, [user])

  const [form, setForm] = useState({
    nome: '',
    funcao: '',
    nova_senha: '',
    confirmar_senha: '',
  })
  const [loading, setLoading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarOk, setAvatarOk] = useState(false)
  const { success, error } = useToast()
  const navigate = useNavigate()

  const uploadMutation = useMutation({
    mutationFn: (file: File) => perfilService.uploadAvatar(file),
    onSuccess: async () => {
      await refreshUser()
      setAvatarError(null)
      setAvatarOk(true)
      setTimeout(() => setAvatarOk(false), 2000)
    },
    onError: (err) => {
      setAvatarError(err instanceof ApiError ? err.message : 'Erro ao enviar foto')
    },
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.nova_senha !== form.confirmar_senha) {
      error('As senhas não coincidem.')
      return
    }
    if (form.nova_senha === SENHA_PADRAO_TEMPORARIA) {
      error('Escolha uma senha diferente da senha temporária padrão.')
      return
    }
    const senhaInvalida = validarSenhaSegura(form.nova_senha)
    if (senhaInvalida) {
      error(senhaInvalida)
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/primeiro-acesso', {
        nome: form.nome,
        funcao: form.funcao,
        nova_senha: form.nova_senha,
        confirmar_senha: form.confirmar_senha,
      })
      await refreshUser()
      success('Cadastro concluído!')
      navigate('/jogos')
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao salvar perfil')
    } finally {
      setLoading(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setAvatarError('Use uma imagem JPEG, PNG ou WebP')
      return
    }
    if (file.size > PERFIL_AVATAR_MAX_BYTES) {
      setAvatarError('A foto deve ter no máximo 2 MB')
      return
    }
    setAvatarError(null)
    uploadMutation.mutate(file)
  }

  const avatarSrc = user?.avatar_url || user?.imagem_perfil

  const inputClass = "w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all duration-150 outline-none"
  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'var(--text)',
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div
            className="inline-flex w-14 h-14 rounded-2xl items-center justify-center text-xl font-black mb-3"
            style={{ background: 'var(--highlight-dim)', border: '1px solid rgba(246,198,91,0.3)', color: 'var(--highlight)' }}
          >
            👋
          </div>
          <h1 className="text-xl font-bold mb-1">Primeiro acesso</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Configure seu perfil e defina sua senha
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div className="flex flex-col items-center gap-3 pb-2">
            <UserAvatar src={avatarSrc} alt="" size="xl" rounded="2xl" />
            <div className="w-full text-center">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Foto de perfil <span className="font-normal normal-case">(opcional)</span>
              </label>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                JPEG, PNG ou WebP — máx. 2 MB
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPickAvatar}
                disabled={uploadMutation.isPending}
                className="text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium mx-auto"
                style={{ color: 'var(--text)' }}
              />
              {uploadMutation.isPending && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Enviando…</p>
              )}
              {avatarOk && (
                <p className="text-xs mt-1 flex items-center justify-center gap-1" style={{ color: 'var(--accent)' }}>
                  <CheckCircle2 size={14} />
                  Foto salva
                </p>
              )}
              {avatarError && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{avatarError}</p>
              )}
            </div>
          </div>

          {[
            { label: 'Nome', key: 'nome' as const, type: 'text', icon: User, placeholder: 'Seu nome', required: true },
            { label: 'Função / cargo', key: 'funcao' as const, type: 'text', icon: Briefcase, placeholder: 'Ex: Analista', required: true },
          ].map(({ label, key, type, icon: Icon, placeholder, required }) => (
            <div key={key}>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {label}
              </label>
              <div className="relative">
                <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={type}
                  {...field(key)}
                  required={required}
                  placeholder={placeholder}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(246,198,91,0.5)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Defina sua senha
            </p>
            {[
              {
                label: 'Nova senha',
                key: 'nova_senha' as const,
                placeholder: '8+ caracteres, 1 maiúscula e 1 especial',
              },
              { label: 'Confirmar senha', key: 'confirmar_senha' as const, placeholder: 'Repita a senha' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="mb-4">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="password"
                    {...field(key)}
                    required
                    minLength={8}
                    placeholder={placeholder}
                    autoComplete="new-password"
                    className={inputClass}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(246,198,91,0.5)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-50"
            style={{ background: 'var(--highlight)', color: '#070A12' }}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              'Concluir cadastro'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
