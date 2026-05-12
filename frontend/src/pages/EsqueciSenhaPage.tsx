import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { perfilService } from '@/services/perfil.service'
import { ApiError } from '@/lib/api'

export function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await perfilService.forgotPassword(email)
      setSent(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Muitas tentativas. Aguarde alguns minutos.')
        setSent(false)
      } else if (
        err instanceof TypeError
        || (err instanceof ApiError && (err.status === 0 || err.status >= 500))
      ) {
        setError('Serviço indisponível no momento. Verifique sua conexão e tente novamente.')
        setSent(false)
      } else if (err instanceof ApiError && err.status >= 400) {
        setError('Não foi possível processar a solicitação. Tente novamente.')
        setSent(false)
      } else {
        setError('Não foi possível processar a solicitação. Tente novamente.')
        setSent(false)
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
            style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
          >
            <Mail size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Esqueci minha senha
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Informe seu e-mail e enviaremos as instruções
          </p>
        </div>

        {sent ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            <CheckCircle2 size={48} style={{ color: 'var(--accent)' }} />
            <div className="text-center">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>
                Solicitação enviada!
              </p>
              <p
                className="text-sm mt-1 leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                Se existir uma conta vinculada ao e-mail informado, você receberá as instruções de
                redefinição em breve.
              </p>
            </div>
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--accent)' }}
            >
              <ArrowLeft size={14} />
              Voltar ao login
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                E-mail
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
              >
                <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
              </div>
            </div>

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
              disabled={loading || !email}
              whileTap={{ scale: 0.97 }}
              className="py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {loading ? 'Enviando…' : 'Enviar instruções'}
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
