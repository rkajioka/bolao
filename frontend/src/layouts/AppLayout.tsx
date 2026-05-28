import { Suspense, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays,
  Star,
  ScrollText,
  Trophy,
  LogOut,
  Moon,
  Sun,
  Users,
  Shield,
  SlidersHorizontal,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { useEmpresaTheme } from '@/hooks/useEmpresaTheme'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { UserAvatar } from '@/components/UserAvatar'
import { OwnerNavBlockedDialog } from '@/components/OwnerNavBlockedDialog'

interface NavItem {
  to: string
  end?: boolean
  icon: ReactNode
  label: string
  visible?: boolean
  disabledForOwner?: boolean
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'rgba(53,208,127,0.2)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  )
}

export function AppLayout() {
  const { user, logout, canManageEquipe, canManageTorneio, isOwner } = useAuth()
  const { isDark, toggle } = useTheme()
  useEmpresaTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const outlet = useOutlet({ key: location.pathname })
  const [ownerBlockedSection, setOwnerBlockedSection] = useState<string | null>(null)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navItems: NavItem[] = [
    {
      to: '/jogos',
      icon: <CalendarDays size={22} />,
      label: isOwner ? 'Jogos' : 'Palpites',
      visible: true,
    },
    {
      to: '/especiais',
      icon: <Star size={22} />,
      label: 'Especiais',
      visible: true,
      disabledForOwner: true,
    },
    {
      to: '/regras',
      icon: <ScrollText size={22} />,
      label: 'Regras',
      visible: true,
      disabledForOwner: true,
    },
    { to: '/ranking', icon: <Trophy size={22} />, label: 'Ranking', visible: true },
    {
      to: '/equipe',
      icon: <Users size={22} />,
      label: 'Equipe',
      visible: !!canManageEquipe,
      disabledForOwner: true,
    },
    { to: '/admin', end: true, icon: <Shield size={22} />, label: 'Torneio', visible: !!canManageTorneio },
    {
      to: '/admin/config',
      icon: <SlidersHorizontal size={22} />,
      label: 'Bolão',
      visible: !!canManageEquipe,
    },
  ]

  const visibleItems = navItems.filter((item) => item.visible)

  const avatarSrc = user?.avatar_url || user?.imagem_perfil

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)', transition: 'background 200ms ease' }}>
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-black focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Pular para o conteúdo
      </a>
      {/* Topbar */}
      <header
        className="sticky top-0 z-50 flex-shrink-0"
        style={{
          background: 'var(--topbar-bg)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingTop: 'var(--safe-top)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <BrandLogo className="w-7 h-7" />
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>
              Bolão da Copa LPC
            </span>
          </div>

          {/* Right side: user + theme toggle + logout */}
          <div className="flex items-center gap-2">
            {/* Avatar — clicável para ir ao perfil */}
            {user && (
              <button
                type="button"
                onClick={() => navigate('/perfil')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                aria-label="Meu perfil"
              >
                <UserAvatar
                  src={avatarSrc}
                  alt={user.nome}
                  size="sm"
                  style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
                />
                <span
                  className="text-sm font-medium hidden sm:block truncate max-w-[120px]"
                  style={{ color: 'var(--text)' }}
                >
                  {user.nome}
                </span>
              </button>
            )}

            {/* Theme toggle */}
            <motion.button
              type="button"
              onClick={toggle}
              whileTap={{ scale: 0.88 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={isDark ? 'Modo claro' : 'Modo escuro'}
            >
              <motion.div
                key={isDark ? 'moon' : 'sun'}
                initial={{ rotate: -30, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </motion.div>
            </motion.button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair da conta"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="conteudo-principal" className="flex-1 max-w-2xl w-full mx-auto px-4 pt-4 safe-bottom">
        <AnimatePresence initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
          >
            <Suspense fallback={<PageFallback />}>
              {outlet}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom navigation */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: 'var(--nav-bg)',
          borderTop: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          paddingBottom: 'var(--safe-bottom)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-stretch h-16">
          {visibleItems.map((item) => {
            const isOwnerBlocked = isOwner && item.disabledForOwner

            if (isOwnerBlocked) {
              return (
                <button
                  key={item.to}
                  type="button"
                  aria-disabled="true"
                  onClick={() => setOwnerBlockedSection(item.label)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 relative opacity-50"
                >
                  <span className="flex flex-col items-center gap-1 blur-[1.5px] pointer-events-none">
                    <span style={{ color: 'var(--text-muted)' }} className="transition-colors duration-150">
                      {item.icon}
                    </span>
                    <span
                      className="text-[10px] font-semibold tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {item.label}
                    </span>
                  </span>
                </button>
              )
            }

            return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-150 relative',
                  isActive ? 'opacity-100' : 'opacity-45 hover:opacity-70',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-current={isActive ? 'page' : undefined}
                    style={{ color: isActive ? 'var(--accent)' : 'var(--text)' }}
                    className="transition-colors duration-150"
                  >
                    {item.icon}
                  </span>
                  <span
                    className="text-[10px] font-semibold tracking-wide"
                    style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                      style={{ background: 'var(--accent)' }}
                    />
                  )}
                </>
              )}
            </NavLink>
            )
          })}
        </div>
      </nav>

      {ownerBlockedSection && (
        <OwnerNavBlockedDialog
          sectionLabel={ownerBlockedSection}
          onClose={() => setOwnerBlockedSection(null)}
        />
      )}
    </div>
  )
}
