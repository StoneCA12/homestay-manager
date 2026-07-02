import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Home,
  CalendarDays,
  Sparkles,
  Bike,
  Wallet,
  Settings as SettingsIcon,
  LogOut,
  House,
  ScrollText,
  FileBarChart2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'nav.dashboard', icon: Home, minRole: 'RECEPTIONIST' },
  { to: '/bookings', label: 'nav.bookings', icon: CalendarDays, minRole: 'RECEPTIONIST' },
  { to: '/housekeeping', label: 'nav.housekeeping', icon: Sparkles, minRole: 'RECEPTIONIST' },
  { to: '/xe-may', label: 'nav.bikrentals', icon: Bike, minRole: 'RECEPTIONIST' },
  { to: '/hoat-dong', label: 'nav.activity', icon: ScrollText, minRole: 'RECEPTIONIST' },
  { to: '/reports', label: 'nav.reports', icon: FileBarChart2, minRole: 'ADMIN' },
  { to: '/revenue', label: 'nav.revenue', icon: Wallet, minRole: 'ADMIN' },
  { to: '/settings', label: 'nav.settings', icon: SettingsIcon, minRole: 'ADMIN' },
] as const

type Role = 'OWNER' | 'ADMIN' | 'RECEPTIONIST'
const ROLE_RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, RECEPTIONIST: 1 }

function hasAccess(userRole: Role | undefined, minRole: string): boolean {
  if (!userRole) return false
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole as Role]
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  const visibleNav = NAV.filter(({ minRole }) => hasAccess(user?.role as Role, minRole))
  const initials =
    user?.full_name?.split(' ').map((n) => n[0]).slice(-2).join('') ?? '?'

  return (
    <aside className="flex h-full min-h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <House className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Homestay</p>
          <p className="truncate text-xs text-muted-foreground">{t('nav.dashboard')}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {visibleNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t(label as any)}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="space-y-3 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t(`role.${user?.role}` as any)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={logout}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </Button>
      </div>
    </aside>
  )
}
