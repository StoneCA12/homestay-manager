import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usersApi } from '../../services/api'
import type { User, UserRole } from '../../types'

interface FormState {
  email: string
  password: string
  full_name: string
  role: UserRole
}

const EMPTY: FormState = { email: '', password: '', full_name: '', role: 'RECEPTIONIST' }
const ROLES: UserRole[] = ['RECEPTIONIST', 'ADMIN', 'OWNER']

interface Props {
  onClose: () => void
  onCreated: (user: User) => void
}

export default function AddUserModal({ onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const created = await usersApi.create(form)
      onCreated(created)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">{t('settings.addUser.title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('settings.addUser.name')} *</label>
            <input required value={form.full_name} onChange={set('full_name')} placeholder="Nguyen Van A" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('settings.addUser.email')} *</label>
            <input required type="email" value={form.email} onChange={set('email')} placeholder="staff@homestay.com" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('settings.addUser.password')} *</label>
            <input required type="password" minLength={8} value={form.password} onChange={set('password')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('settings.addUser.role')}</label>
            <select value={form.role} onChange={set('role')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`role.${r}` as any)}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
              {submitting ? t('settings.addUser.submitting') : t('settings.addUser.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
