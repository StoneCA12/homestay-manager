import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usersApi } from '../../services/api'
import type { User, UserRole } from '../../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FormState {
  email: string
  password: string
  full_name: string
  role: UserRole
}

const EMPTY: FormState = { email: '', password: '', full_name: '', role: 'RECEPTIONIST' }
const ROLES: UserRole[] = ['RECEPTIONIST', 'ADMIN', 'OWNER']

const SELECT_CLASS =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('settings.addUser.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="space-y-1">
            <Label className="text-xs">{t('settings.addUser.name')} *</Label>
            <Input required value={form.full_name} onChange={set('full_name')} placeholder="Nguyen Van A" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('settings.addUser.email')} *</Label>
            <Input required type="email" value={form.email} onChange={set('email')} placeholder="staff@homestay.com" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('settings.addUser.password')} *</Label>
            <Input required type="password" minLength={8} value={form.password} onChange={set('password')} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('settings.addUser.role')}</Label>
            <select value={form.role} onChange={set('role')} className={SELECT_CLASS}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`role.${r}` as any)}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
              {submitting ? t('settings.addUser.submitting') : t('settings.addUser.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
