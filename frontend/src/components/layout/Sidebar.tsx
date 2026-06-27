import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/',             label: 'nav.dashboard',    icon: '🏠', minRole: 'RECEPTIONIST' },
  { to: '/bookings',     label: 'nav.bookings',     icon: '📅', minRole: 'RECEPTIONIST' },
  { to: '/housekeeping', label: 'nav.housekeeping', icon: '🧹', minRole: 'RECEPTIONIST' },
  { to: '/xe-may',       label: 'nav.bikrentals',   icon: '🏍️', minRole: 'RECEPTIONIST' },
  { to: '/revenue',      label: 'nav.revenue',      icon: '💰', minRole: 'ADMIN'        },
  { to: '/settings',     label: 'nav.settings',     icon: '⚙️', minRole: 'ADMIN'        },
] as const

type Role = 'OWNER' | 'ADMIN' | 'RECEPTIONIST'
const ROLE_RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, RECEPTIONIST: 1 }

function hasAccess(userRole: Role | undefined, minRole: string): boolean {
  if (!userRole) return false
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole as Role]
}

const ROLE_BADGE: Record<string, string> = {
  OWNER:        'bg-purple-500/20 text-purple-300',
  ADMIN:        'bg-blue-500/20 text-blue-300',
  RECEPTIONIST: 'bg-slate-600 text-slate-300',
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  const visibleNav = NAV.filter(({ minRole }) => hasAccess(user?.role as Role, minRole))

  return (
    <aside className="w-56 min-h-screen bg-slate-800 flex flex-col">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg tracking-tight">🏠 Homestay</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleNav.map(({ to, label, icon }) => (
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
            <span className="text-base">{icon}</span>
            {t(label as any)}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-slate-700 space-y-3">
        <div>
          <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[user?.role ?? 'RECEPTIONIST']}`}>
            {t(`role.${user?.role}` as any)}
          </span>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white text-sm transition-colors"
        >
          <span>↩</span>
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
