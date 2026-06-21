import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import DashboardPage from './pages/Dashboard'
import BookingsPage from './pages/Bookings'
import HousekeepingPage from './pages/Housekeeping'
import RevenuePage from './pages/Revenue'
import SettingsPage from './pages/Settings'
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
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
        path="/settings"
        element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
