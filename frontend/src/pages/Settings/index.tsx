import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/layout/Layout'
import AddUserModal from '../../components/settings/AddUserModal'
import { useAuth } from '../../contexts/AuthContext'
import { usersApi } from '../../services/api'
import type { User, UserRole } from '../../types'

const ROLE_BADGE: Record<UserRole, string> = {
  OWNER:        'bg-purple-100 text-purple-700',
  ADMIN:        'bg-blue-100 text-blue-700',
  RECEPTIONIST: 'bg-gray-100 text-gray-600',
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const isOwner = me?.role === 'OWNER'

  useEffect(() => {
    usersApi.list().then(setUsers).finally(() => setLoading(false))
  }, [])

  const handleToggle = async (user: User) => {
    setToggling(user.id)
    try {
      const updated = await usersApi.toggleActive(user.id)
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
    } catch {
      // silently ignore — UI stays as-is if the request fails
    } finally {
      setToggling(null)
    }
  }

  return (
    <Layout>
      <div className="p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('settings.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('settings.users.title')}</p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {t('settings.users.newUser')}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">{t('bookings.loading')}</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-gray-200">
                <tr>
                  {[
                    t('settings.users.table.name'),
                    t('settings.users.table.email'),
                    t('settings.users.table.role'),
                    t('settings.users.table.status'),
                    ...(isOwner ? [t('settings.users.table.actions')] : []),
                  ].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {u.full_name}
                      {u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_BADGE[u.role]}`}>
                        {t(`role.${u.role}` as any)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? t('settings.users.active') : t('settings.users.inactive')}
                      </span>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3">
                        {u.id !== me?.id && (
                          <button
                            disabled={toggling === u.id}
                            onClick={() => handleToggle(u)}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              u.is_active
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}
                          >
                            {toggling === u.id ? '…' : u.is_active ? t('settings.users.deactivate') : t('settings.users.reactivate')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <AddUserModal
          onClose={() => setShowForm(false)}
          onCreated={(user) => { setUsers((prev) => [...prev, user]); setShowForm(false) }}
        />
      )}
    </Layout>
  )
}
