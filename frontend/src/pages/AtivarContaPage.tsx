import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, User, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { equipeService } from '@/services/equipe.service'
import { PERFIL_AVATAR_MAX_BYTES } from '@/services/perfil.service'
import { UserAvatar } from '@/components/UserAvatar'
import { setToken } from '@/lib/api'
import { ApiError } from '@/lib/api'
import { validarSenhaSegura } from '@/lib/passwordPolicy'

export function AtivarContaPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarOk, setAvatarOk] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => equipeService.uploadAvatarPreAtivacao(token, file),
    onSuccess: (data) => {
      setAvatarUrl(data.avatar_url)
      setAvatarError(null)
      setAvatarOk(true)
      setTimeout(() => setAvatarOk(false), 2000)
    },
    onError: (err) => {
      setAvatarError(err instanceof ApiError ? err.message : 'Erro ao enviar foto')
    },
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

  if (!token) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Link inválido
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            O link de ativação é inválido ou expirou.
          </p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha !== confirmar) {
      setError('As senhas não coincidem')
      return
    }
    const senhaInvalida = validarSenhaSegura(senha)
    if (senhaInvalida) {
      setError(senhaInvalida)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await equipeService.ativarConta(
        token,
        nome,
        senha,
        confirmar,
        avatarUrl ?? undefined,
      )
      setToken(res.access_token)
      await refreshUser()
      setSuccess(true)
      setTimeout(() => navigate('/jogos', { replace: true }), 1500)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Erro inesperado. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Ativar conta
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Complete seu cadastro para acessar o bolão
          </p>
        </div>

        {success ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <CheckCircle2 size={48} style={{ color: 'var(--accent)' }} />
            <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
              Conta ativada com sucesso!
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Redirecionando…
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Nome */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Seu nome
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
              >
                <User size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Foto de perfil (upload) */}
            <div className="flex flex-col gap-2 items-center">
              <UserAvatar src={avatarUrl ?? undefined} alt="" size="xl" rounded="2xl" />
              <label className="text-sm font-medium text-center w-full" style={{ color: 'var(--text)' }}>
                Foto de perfil{' '}
                <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                  (opcional)
                </span>
              </label>
              <p className="text-xs text-center w-full" style={{ color: 'var(--text-muted)' }}>
                JPEG, PNG ou WebP — máx. 2 MB
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPickAvatar}
                disabled={uploadMutation.isPending || !token}
                className="text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium w-full"
                style={{ color: 'var(--text)' }}
              />
              {uploadMutation.isPending && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Enviando…
                </p>
              )}
              {avatarOk && (
                <p className="text-xs flex items-center justify-center gap-1" style={{ color: 'var(--accent)' }}>
                  <CheckCircle2 size={14} />
                  Foto pronta — será aplicada ao ativar
                </p>
              )}
              {avatarError && (
                <p className="text-xs text-center" style={{ color: '#ef4444' }}>
                  {avatarError}
                </p>
              )}
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Criar senha
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
              >
                <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Confirmar senha
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
              >
                <Lock size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {error}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={loading || !nome || !senha || !confirmar}
              whileTap={{ scale: 0.97 }}
              className="py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'Ativando conta…' : 'Ativar conta'}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  )
}
