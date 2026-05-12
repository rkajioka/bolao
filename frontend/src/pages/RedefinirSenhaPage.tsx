import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { perfilService } from '@/services/perfil.service'
import { ApiError, setToken } from '@/lib/api'
import { validarSenhaSegura } from '@/lib/passwordPolicy'

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  showSenha: boolean
  onToggleShowSenha: () => void
  autoFocus?: boolean
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  showSenha,
  onToggleShowSenha,
  autoFocus,
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <div
        className="flex h-11 items-center gap-2 px-3 rounded-xl"
        style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
      >
        <Lock size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <input
          type={showSenha ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--text)' }}
        />
        <button
          type="button"
          onClick={onToggleShowSenha}
          className="flex h-8 w-8 shrink-0 items-center justify-center"
          style={{ color: 'var(--text-muted)' }}
          aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {showSenha ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

export function RedefinirSenhaPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Link inválido
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            O link de redefinição é inválido ou expirou.
          </p>
          <Link to="/login" className="text-sm mt-4 block" style={{ color: 'var(--accent)' }}>
            Voltar ao login
          </Link>
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
      const res = await perfilService.redefinirSenha(token, senha, confirmar)
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
        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Redefinir senha
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Crie uma nova senha segura para sua conta
          </p>
        </div>

        {success ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <CheckCircle2 size={48} style={{ color: 'var(--accent)' }} />
            <div className="text-center">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>
                Senha redefinida!
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Entrando no bolão…
              </p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <PasswordField
              label="Nova senha"
              value={senha}
              onChange={setSenha}
              placeholder="8+ caracteres, 1 maiúscula e 1 especial"
              showSenha={showSenha}
              onToggleShowSenha={() => setShowSenha((v) => !v)}
              autoFocus
            />

            <PasswordField
              label="Confirmar senha"
              value={confirmar}
              onChange={setConfirmar}
              placeholder="Repita a senha"
              showSenha={showSenha}
              onToggleShowSenha={() => setShowSenha((v) => !v)}
            />

            {error && (
              <p
                className="text-sm px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                {error}
              </p>
            )}

            <motion.button
              type="submit"
              disabled={loading || !senha || !confirmar}
              whileTap={{ scale: 0.97 }}
              className="py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </motion.button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <ArrowLeft size={14} />
              Voltar ao login
            </Link>
          </form>
        )}
      </motion.div>
    </div>
  )
}
