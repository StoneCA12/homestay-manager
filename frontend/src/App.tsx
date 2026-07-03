import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useToast } from './contexts/ToastContext'
import DashboardPage from './pages/Dashboard'
import BookingsPage from './pages/Bookings'
import BikeRentalsPage from './pages/BikeRentals'
import HousekeepingPage from './pages/Housekeeping'
import RevenuePage from './pages/Revenue'
import SettingsPage from './pages/Settings'
import ActivityPage from './pages/Activity'
import EndOfDayPage from './pages/Reports/EndOfDay'
import LoginPage from './pages/Login'
import type { UserRole } from './types'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RoleRoute({ children, roles }: { children: ReactNode; roles: UserRole[] }) {
  const { user, isLoading } = useAuth()
  const { showToast } = useToast()
  const denied = !isLoading && !!user && !roles.includes(user.role)

  useEffect(() => {
    if (denied) showToast('Bạn không có quyền truy cập trang này.', 'error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied])

  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (denied) return <Navigate to="/" replace />
  return <>{children}</>
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
      />
      <Route
        path="/bookings"
        element={<ProtectedRoute><BookingsPage /></ProtectedRoute>}
      />
      <Route
        path="/housekeeping"
        element={<ProtectedRoute><HousekeepingPage /></ProtectedRoute>}
      />
      <Route
        path="/revenue"
        element={<RoleRoute roles={['OWNER', 'ADMIN']}><RevenuePage /></RoleRoute>}
      />
      <Route
        path="/xe-may"
        element={<ProtectedRoute><BikeRentalsPage /></ProtectedRoute>}
      />
      <Route
        path="/settings"
        element={<RoleRoute roles={['OWNER', 'ADMIN']}><SettingsPage /></RoleRoute>}
      />
      <Route
        path="/hoat-dong"
        element={<RoleRoute roles={['OWNER']}><ActivityPage /></RoleRoute>}
      />
      <Route
        path="/reports"
        element={<RoleRoute roles={['OWNER', 'ADMIN']}><EndOfDayPage /></RoleRoute>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
