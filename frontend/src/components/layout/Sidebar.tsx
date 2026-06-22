import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/',             key: 'nav.dashboard',    icon: '🏠', ownerOnly: false, adminUp: false },
  { to: '/bookings',     key: 'nav.bookings',     icon: '📅', ownerOnly: false, adminUp: false },
  { to: '/housekeeping', key: 'nav.housekeeping', icon: '🧹', ownerOnly: false, adminUp: false },
  { to: '/revenue',      key: 'nav.revenue',      icon: '💰', ownerOnly: false, adminUp: true  },
  { to: '/settings',     key: 'nav.settings',     icon: '⚙️', ownerOnly: true,  adminUp: false },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  const visibleNav = NAV.filter(({ ownerOnly, adminUp }) => {
    if (ownerOnly) return user?.role === 'OWNER'
    if (adminUp) return user?.role === 'OWNER' || user?.role === 'ADMIN'
    return true
  })

  return (
    <aside className="w-56 min-h-screen bg-slate-800 flex flex-col">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg tracking-tight">🏠 Homestay</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleNav.map(({ to, key, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {t(key as any)}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-slate-700">
        <p className="text-slate-400 text-xs truncate">{user?.full_name}</p>
        <p className="text-slate-500 text-xs truncate mb-3">{t(`role.${user?.role}` as any)}</p>
        <button
          onClick={logout}
          className="w-full text-left text-slate-400 hover:text-white text-xs py-1 transition-colors"
        >
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
