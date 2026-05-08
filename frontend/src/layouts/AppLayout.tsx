import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CalendarDays,
  Star,
  ScrollText,
  Trophy,
  Settings,
  LogOut,
  User,
  Moon,
  Sun,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { cn, imgUrl } from '@/lib/utils'

interface NavItem {
  to: string
  icon: ReactNode
  label: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { to: '/jogos', icon: <CalendarDays size={22} />, label: 'Palpites' },
  { to: '/especiais', icon: <Star size={22} />, label: 'Especiais' },
  { to: '/regras', icon: <ScrollText size={22} />, label: 'Regras' },
  { to: '/ranking', icon: <Trophy size={22} />, label: 'Ranking' },
  { to: '/admin', icon: <Settings size={22} />, label: 'Admin', adminOnly: true },
]

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout, isAdmin } = useAuth()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)', transition: 'background 200ms ease' }}>
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
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
              style={{ background: 'var(--accent)', color: isDark ? '#070A12' : '#fff' }}
            >
              B
            </div>
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text)' }}>
              Bolão da Copa
            </span>
          </div>

          {/* Right side: user + theme toggle + logout */}
          <div className="flex items-center gap-2">
            {/* Avatar */}
            {user && (
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden"
                  style={{ background: 'var(--glass)', border: '1px solid var(--border)' }}
                >
                  {user.imagem_perfil ? (
                    <img
                      src={imgUrl(user.imagem_perfil)}
                      alt={user.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <span
                  className="text-sm font-medium hidden sm:block truncate max-w-[120px]"
                  style={{ color: 'var(--text)' }}
                >
                  {user.nome}
                </span>
              </div>
            )}

            {/* Theme toggle */}
            <motion.button
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
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-4 safe-bottom">
        {children}
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
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                      style={{ background: 'var(--accent)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
