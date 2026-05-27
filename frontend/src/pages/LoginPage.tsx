import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useToast } from '@/components/Toast'
import { ApiError } from '@/lib/api'

function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  if (next.includes('://')) return null
  return next
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const { login, isAuthenticated, user, isLoading } = useAuth()
  const { error } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    const next = safeNextPath(searchParams.get('next'))
    if (next) {
      navigate(next, { replace: true })
      return
    }
    navigate(user?.primeiro_login ? '/primeiro-acesso' : '/jogos', { replace: true })
  }, [isAuthenticated, isLoading, navigate, searchParams, user?.primeiro_login])

  if (!isLoading && isAuthenticated) {
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { primeiro_login } = await login(email, senha)
      const next = safeNextPath(searchParams.get('next'))
      if (next) {
        navigate(next, { replace: true })
      } else if (primeiro_login) {
        navigate('/primeiro-acesso')
      } else {
        navigate('/jogos')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        error(err.message || 'Usuário bloqueado pelo administrador')
      } else {
        error(err instanceof Error ? err.message : 'Falha no login')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      {/* Background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(53,208,127,0.08) 0%, transparent 70%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-16 h-16 rounded-2xl items-center justify-center text-2xl font-black mb-4"
            style={{ background: 'var(--accent)', color: '#070A12' }}
          >
            ⚽
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Bolão da Copa</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Entre para fazer seus palpites
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              E-mail
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                placeholder="seu@email.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm transition-all duration-150 outline-none"
                style={{
                  background: 'var(--glass)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(53,208,127,0.5)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--border)')
                }
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="senha"
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Senha
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                id="senha"
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 rounded-xl text-sm transition-all duration-150 outline-none"
                style={{
                  background: 'var(--glass)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(53,208,127,0.5)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--border)')
                }
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
                aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-50 mt-2"
            style={{ background: 'var(--accent)', color: '#070A12' }}
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div className="text-center pt-1">
            <Link
              to="/esqueci-senha"
              className="text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              Esqueci minha senha
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
