import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Shield, Cookie, Database, Mail, Clock } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useCookieConsent } from '@/hooks/useCookieConsent'

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h2>
      </div>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: 'var(--text-muted)' }}>
        {children}
      </div>
    </div>
  )
}

function CookieRow({
  name,
  type,
  purpose,
  duration,
}: {
  name: string
  type: string
  purpose: string
  duration: string
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text)' }}>
          {name}
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          {type}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {purpose}
      </p>
      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
        Duração: {duration}
      </p>
    </div>
  )
}

export function PrivacidadePage() {
  const { consent, accept, reject, reset } = useCookieConsent()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const handleBack = () => {
    // Se houver histórico de navegação, volta; caso contrário vai para a tela inicial
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      navigate(isAuthenticated ? '/jogos' : '/login', { replace: true })
    }
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Background gradient decorativo */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(53,208,127,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: 'var(--topbar-bg)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingTop: 'var(--safe-top)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 h-14">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150"
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              Política de Privacidade
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Última atualização: maio de 2025
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 pb-12 space-y-4 relative"
      >
        {/* Intro */}
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Esta Política de Privacidade descreve como o{' '}
          <strong style={{ color: 'var(--text)' }}>Bolão da Copa LPC</strong> coleta, usa e protege
          suas informações pessoais. Ao usar nossa plataforma, você concorda com as práticas
          descritas aqui.
        </p>

        {/* Dados coletados */}
        <Section icon={<Database size={16} />} title="Dados que coletamos">
          <p>Coletamos apenas os dados necessários para o funcionamento do bolão:</p>
          <ul className="space-y-1.5 mt-2">
            {[
              { label: 'Nome completo', desc: 'Para identificação na plataforma e no ranking' },
              { label: 'E-mail', desc: 'Para acesso à conta, comunicados e recuperação de senha' },
              { label: 'Foto de perfil', desc: 'Opcional — exibida no ranking e na equipe' },
              { label: 'Palpites', desc: 'Suas apostas em jogos e eventos especiais' },
              {
                label: 'Dados de acesso',
                desc: 'Data e horário de login para segurança da conta, sem rastreamento de comportamento',
              },
            ].map((item) => (
              <li key={item.label} className="flex gap-2">
                <span style={{ color: 'var(--accent)' }} className="mt-0.5 shrink-0">
                  •
                </span>
                <span>
                  <strong style={{ color: 'var(--text)' }}>{item.label}:</strong> {item.desc}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Cookies */}
        <Section icon={<Cookie size={16} />} title="Cookies utilizados">
          <p>
            Utilizamos exclusivamente cookies{' '}
            <strong style={{ color: 'var(--text)' }}>essenciais</strong> para o funcionamento da
            plataforma. Não usamos cookies de rastreamento, publicidade ou análise de comportamento
            de terceiros.
          </p>
          <div className="space-y-2 mt-3">
            <CookieRow
              name="refresh_token"
              type="Essencial"
              purpose="Mantém sua sessão ativa após o login, evitando que você precise entrar novamente a cada visita."
              duration="7 dias (renovado a cada acesso)"
            />
            <CookieRow
              name="cookie_consent"
              type="Funcional"
              purpose="Salva sua escolha sobre o uso de cookies para não exibirmos o aviso novamente."
              duration="Sem expiração / até você limpar o navegador"
            />
          </div>
          <p className="mt-3 text-xs" style={{ opacity: 0.8 }}>
            ⚠️ O cookie de sessão é necessário para o login. Ao rejeitar cookies, você poderá
            navegar durante a visita atual, mas precisará entrar novamente ao reabrir o aplicativo.
          </p>
        </Section>

        {/* Uso dos dados */}
        <Section icon={<Shield size={16} />} title="Como usamos seus dados">
          <ul className="space-y-1.5">
            {[
              'Permitir o acesso à sua conta de forma segura',
              'Exibir seus palpites, pontuação e posição no ranking',
              'Enviar e-mails de ativação de conta e recuperação de senha',
              'Encaminhar comunicados do administrador do seu bolão',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span style={{ color: 'var(--accent)' }} className="mt-0.5 shrink-0">
                  •
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Não vendemos, alugamos nem compartilhamos seus dados com terceiros para fins comerciais.
          </p>
        </Section>

        {/* Retenção */}
        <Section icon={<Clock size={16} />} title="Retenção de dados">
          <p>
            Seus dados permanecem na plataforma enquanto sua conta estiver ativa. Após o
            encerramento do torneio ou exclusão da conta, os dados podem ser anonimizados ou
            removidos conforme solicitado pelo administrador da empresa.
          </p>
        </Section>

        {/* Segurança */}
        <Section icon={<Shield size={16} />} title="Segurança">
          <p>
            Toda a comunicação entre seu dispositivo e nossa plataforma é protegida por
            criptografia. Seus dados são armazenados de forma segura e o acesso é restrito: apenas
            você e os administradores autorizados do seu bolão podem visualizá-los.
          </p>
        </Section>

        {/* Contato */}
        <Section icon={<Mail size={16} />} title="Seus direitos e contato">
          <p>
            Você tem o direito de acessar, corrigir ou solicitar a exclusão dos seus dados
            pessoais. Para exercer esses direitos ou tirar dúvidas, entre em contato com o
            administrador do seu bolão ou com a empresa responsável pela plataforma.
          </p>
        </Section>

        {/* Gerenciar preferências */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
            Suas preferências de cookies
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            {consent === 'accepted' && '✅ Você aceitou o uso de cookies.'}
            {consent === 'rejected' && '❌ Você rejeitou o uso de cookies.'}
            {consent === null && '⏳ Você ainda não definiu sua preferência.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {consent !== 'accepted' && (
              <button
                type="button"
                onClick={accept}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{ background: 'var(--accent)', color: '#070A12' }}
              >
                Aceitar cookies
              </button>
            )}
            {consent !== 'rejected' && (
              <button
                type="button"
                onClick={reject}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{
                  background: 'var(--glass)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                Rejeitar cookies
              </button>
            )}
            {consent !== null && (
              <button
                type="button"
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{
                  background: 'var(--glass)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                Redefinir preferência
              </button>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p
          className="text-[11px] text-center pb-4"
          style={{ color: 'var(--text-muted)', opacity: 0.6 }}
        >
          Esta política pode ser atualizada periodicamente. Recomendamos revisá-la ocasionalmente.
        </p>
      </motion.main>
    </div>
  )
}
