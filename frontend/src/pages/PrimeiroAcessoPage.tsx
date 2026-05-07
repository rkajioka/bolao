import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Briefcase, Image, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/Toast'

export function PrimeiroAcessoPage() {
  const [form, setForm] = useState({
    nome: '',
    funcao: '',
    imagem_perfil: '',
    nova_senha: '',
    confirmar_senha: '',
  })
  const [loading, setLoading] = useState(false)
  const { success, error } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.nova_senha !== form.confirmar_senha) {
      error('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/primeiro-acesso', {
        nome: form.nome,
        funcao: form.funcao,
        imagem_perfil: form.imagem_perfil || null,
        nova_senha: form.nova_senha,
        confirmar_senha: form.confirmar_senha,
      })
      success('Perfil criado! Entre com sua nova senha.')
      navigate('/login')
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
          {[
            { label: 'Nome', key: 'nome' as const, type: 'text', icon: User, placeholder: 'Seu nome', required: true },
            { label: 'Função / cargo', key: 'funcao' as const, type: 'text', icon: Briefcase, placeholder: 'Ex: Analista', required: true },
            { label: 'URL da foto (opcional)', key: 'imagem_perfil' as const, type: 'url', icon: Image, placeholder: 'https://...', required: false },
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
              { label: 'Nova senha', key: 'nova_senha' as const, placeholder: 'Mínimo 8 caracteres' },
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
