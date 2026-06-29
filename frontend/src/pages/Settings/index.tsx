import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/layout/Layout'
import AddUserModal from '../../components/settings/AddUserModal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { authApi, roomsApi, settingsApi, usersApi } from '../../services/api'
import type { CommissionRate, Room, RoomType, User, UserRole } from '../../types'
import { formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ROLE_BADGE: Record<UserRole, string> = {
  OWNER:        'bg-purple-100 text-purple-700',
  ADMIN:        'bg-blue-100 text-blue-700',
  RECEPTIONIST: 'bg-muted text-muted-foreground',
}

const OTA_LABEL: Record<string, string> = {
  AGODA:       'Agoda',
  BOOKING_COM: 'Booking.com',
  TRAVELOKA:   'Traveloka',
  ZALO:        'Zalo',
  DIRECT:      'Trực tiếp',
}

const ROOM_TYPES: RoomType[] = ['FAMILY', 'WINDOW', 'BALCONY', 'REGULAR']
const HK_STATUSES = ['AVAILABLE', 'DIRTY', 'CLEANING', 'OUT_OF_ORDER']

const SELECT_CLASS =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

interface RoomForm {
  room_number: string
  room_type: string
  floor: string
  capacity: string
  base_price: string
  housekeeping_status: string
}

const EMPTY_ROOM_FORM: RoomForm = {
  room_number: '', room_type: 'REGULAR', floor: '1', capacity: '2', base_price: '', housekeeping_status: 'AVAILABLE',
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user: me } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const [rates, setRates] = useState<CommissionRate[]>([])
  const [editingRate, setEditingRate] = useState<string | null>(null)
  const [rateInput, setRateInput] = useState('')
  const [savingRate, setSavingRate] = useState(false)

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomModal, setRoomModal] = useState<{ open: boolean; target: Room | null }>({ open: false, target: null })
  const [roomForm, setRoomForm] = useState<RoomForm>(EMPTY_ROOM_FORM)
  const [roomSaving, setRoomSaving] = useState(false)
  const [roomError, setRoomError] = useState('')

  const isOwnerOrAdmin = me?.role === 'OWNER' || me?.role === 'ADMIN'
  const isOwner = me?.role === 'OWNER'

  const [deleteUserDialog, setDeleteUserDialog] = useState<User | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [resetPwInput, setResetPwInput] = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')
  const [resetPwSaving, setResetPwSaving] = useState(false)
  const [resetPwError, setResetPwError] = useState('')

  const [showChangePw, setShowChangePw] = useState(false)
  const [changePwOld, setChangePwOld] = useState('')
  const [changePwNew, setChangePwNew] = useState('')
  const [changePwConfirm, setChangePwConfirm] = useState('')
  const [changePwSaving, setChangePwSaving] = useState(false)
  const [changePwError, setChangePwError] = useState('')

  useEffect(() => {
    usersApi.list().then(setUsers).finally(() => setLoading(false))
    settingsApi.listCommissionRates().then(setRates).catch(() => {})
    roomsApi.list().then(setRooms).catch(() => {})
  }, [])

  const handleDeleteUser = async (user: User) => {
    try {
      await usersApi.delete(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      setDeleteUserDialog(null)
      showToast(t('settings.users.toast.deleted'))
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? t('settings.users.toast.deleteFailed'), 'error')
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return
    if (resetPwInput.length < 8) { setResetPwError(t('settings.password.errorMinLength')); return }
    if (resetPwInput !== resetPwConfirm) { setResetPwError(t('settings.password.errorMismatch')); return }
    setResetPwSaving(true)
    setResetPwError('')
    try {
      await usersApi.resetPassword(resetPasswordUser.id, resetPwInput)
      setResetPasswordUser(null)
      setResetPwInput('')
      setResetPwConfirm('')
      showToast(t('settings.users.toast.passwordReset'))
    } catch (err: any) {
      setResetPwError(err?.response?.data?.detail ?? t('settings.password.errorGeneral'))
    } finally {
      setResetPwSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (changePwNew.length < 8) { setChangePwError(t('settings.password.errorMinLength')); return }
    if (changePwNew !== changePwConfirm) { setChangePwError(t('settings.password.errorMismatch')); return }
    setChangePwSaving(true)
    setChangePwError('')
    try {
      await authApi.changePassword(changePwOld, changePwNew)
      setShowChangePw(false)
      setChangePwOld('')
      setChangePwNew('')
      setChangePwConfirm('')
      showToast(t('settings.users.toast.passwordChanged'))
    } catch (err: any) {
      setChangePwError(err?.response?.data?.detail ?? t('settings.password.errorGeneral'))
    } finally {
      setChangePwSaving(false)
    }
  }

  const handleToggle = async (user: User) => {
    setToggling(user.id)
    try {
      const updated = await usersApi.toggleActive(user.id)
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
    } catch {
    } finally {
      setToggling(null)
    }
  }

  const startEditRate = (rate: CommissionRate) => {
    setEditingRate(rate.ota_source)
    setRateInput((Number(rate.rate) * 100).toFixed(2))
  }

  const saveRate = async (otaSource: string) => {
    setSavingRate(true)
    try {
      const updated = await settingsApi.updateCommissionRate(otaSource, Number(rateInput) / 100)
      setRates((prev) => prev.map((r) => r.ota_source === updated.ota_source ? updated : r))
      setEditingRate(null)
      showToast(t('settings.toast.rateSaved'))
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? t('settings.toast.saveFailed'), 'error')
    } finally {
      setSavingRate(false)
    }
  }

  const openAddRoom = () => {
    setRoomForm(EMPTY_ROOM_FORM)
    setRoomError('')
    setRoomModal({ open: true, target: null })
  }

  const openEditRoom = (room: Room) => {
    setRoomForm({
      room_number: room.room_number,
      room_type: room.room_type,
      floor: String(room.floor),
      capacity: String(room.capacity),
      base_price: String(Math.round(Number(room.base_price))),
      housekeeping_status: room.housekeeping_status,
    })
    setRoomError('')
    setRoomModal({ open: true, target: room })
  }

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setRoomSaving(true)
    setRoomError('')
    try {
      const payload = {
        room_number: roomForm.room_number.trim(),
        room_type: roomForm.room_type,
        floor: Number(roomForm.floor),
        capacity: Number(roomForm.capacity),
        base_price: Number(roomForm.base_price),
        housekeeping_status: roomForm.housekeeping_status,
      }
      if (roomModal.target) {
        const updated = await roomsApi.update(roomModal.target.id, payload)
        setRooms((prev) => prev.map((r) => r.id === updated.id ? updated : r))
        showToast(t('settings.toast.roomSaved'))
      } else {
        const created = await roomsApi.create(payload)
        setRooms((prev) => [...prev, created].sort((a, b) => a.room_number.localeCompare(b.room_number)))
        showToast(t('settings.toast.roomCreated'))
      }
      setRoomModal({ open: false, target: null })
    } catch (err: any) {
      setRoomError(err?.response?.data?.detail ?? 'Không thể lưu phòng.')
    } finally {
      setRoomSaving(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-10 p-4 md:p-8">
        {/* Users */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('settings.title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('settings.users.title')}</p>
            </div>
            {isOwner && (
              <Button onClick={() => setShowForm(true)}>{t('settings.users.newUser')}</Button>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('bookings.loading')}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {[
                      t('settings.users.table.name'),
                      t('settings.users.table.email'),
                      t('settings.users.table.role'),
                      t('settings.users.table.status'),
                      ...(isOwner ? [t('settings.users.table.actions')] : []),
                    ].map((h) => (
                      <TableHead key={h} className="uppercase tracking-wide">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className={cn(!u.is_active && 'opacity-50')}>
                      <TableCell className="font-medium text-foreground">
                        {u.full_name}
                        {u.id === me?.id && <span className="ml-2 text-xs text-muted-foreground">(bạn)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', ROLE_BADGE[u.role])}>
                          {t(`role.${u.role}` as any)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                          {u.is_active ? t('settings.users.active') : t('settings.users.inactive')}
                        </span>
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          {u.id !== me?.id && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="xs"
                                variant="ghost"
                                disabled={toggling === u.id}
                                onClick={() => handleToggle(u)}
                                className={u.is_active ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}
                              >
                                {toggling === u.id ? '...' : u.is_active ? t('settings.users.deactivate') : t('settings.users.reactivate')}
                              </Button>
                              <Button size="xs" variant="ghost" className="text-primary hover:bg-blue-50" onClick={() => { setResetPasswordUser(u); setResetPwInput(''); setResetPwConfirm(''); setResetPwError('') }}>
                                {t('settings.users.resetPassword')}
                              </Button>
                              {u.role !== 'OWNER' && (
                                <Button size="xs" variant="ghost" className="text-destructive hover:bg-red-50" onClick={() => setDeleteUserDialog(u)}>
                                  {t('common.delete')}
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Rooms */}
        {isOwnerOrAdmin && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{t('settings.rooms.title')}</h2>
              <Button onClick={openAddRoom}>{t('settings.rooms.addRoom')}</Button>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {[
                      t('settings.rooms.table.number'),
                      t('settings.rooms.table.type'),
                      t('settings.rooms.table.floor'),
                      t('settings.rooms.table.capacity'),
                      t('settings.rooms.table.basePrice'),
                      t('settings.rooms.table.status'),
                      '',
                    ].map((h, i) => (
                      <TableHead key={i} className="whitespace-nowrap uppercase tracking-wide">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-bold text-foreground">{r.room_number}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          {t(`roomType.${r.room_type}` as any)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.floor}</TableCell>
                      <TableCell className="text-muted-foreground">{r.capacity}</TableCell>
                      <TableCell className="font-medium text-foreground">{formatVND(r.base_price)}</TableCell>
                      <TableCell>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          r.housekeeping_status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' :
                          r.housekeeping_status === 'DIRTY' ? 'bg-red-100 text-red-600' :
                          r.housekeeping_status === 'CLEANING' ? 'bg-amber-100 text-amber-700' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {t(`roomStatus.${r.housekeeping_status}` as any)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="secondary" size="sm" onClick={() => openEditRoom(r)}>
                          {t('settings.rooms.editRoom')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* My account */}
        <div>
          <h2 className="mb-4 text-lg font-bold text-foreground">{t('settings.myAccount.title')}</h2>
          <div className="flex items-center justify-between rounded-xl border bg-card p-5">
            <div>
              <p className="text-sm font-semibold text-foreground">{me?.full_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{me?.email}</p>
            </div>
            <Button variant="secondary" onClick={() => { setChangePwOld(''); setChangePwNew(''); setChangePwConfirm(''); setChangePwError(''); setShowChangePw(true) }}>
              {t('settings.myAccount.changePassword')}
            </Button>
          </div>
        </div>

        {/* Commission rates */}
        {isOwnerOrAdmin && rates.length > 0 && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground">{t('settings.commission.title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('settings.commission.description')}</p>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="uppercase tracking-wide">{t('settings.commission.source')}</TableHead>
                    <TableHead className="uppercase tracking-wide">{t('settings.commission.rate')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((r) => (
                    <TableRow key={r.ota_source}>
                      <TableCell className="font-medium text-foreground">{OTA_LABEL[r.ota_source] ?? r.ota_source}</TableCell>
                      <TableCell>
                        {editingRate === r.ota_source ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min="0" max="100" step="0.01"
                              value={rateInput}
                              onChange={(e) => setRateInput(e.target.value)}
                              className="h-8 w-24"
                              autoFocus
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <span className="font-mono text-foreground">{(Number(r.rate) * 100).toFixed(2)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingRate === r.ota_source ? (
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingRate(null)}>{t('settings.commission.cancel')}</Button>
                            <Button size="sm" disabled={savingRate} onClick={() => saveRate(r.ota_source)}>
                              {savingRate ? t('settings.commission.saving') : t('settings.commission.save')}
                            </Button>
                          </div>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => startEditRate(r)}>{t('settings.commission.edit')}</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Room modal */}
      {roomModal.open && (
        <Dialog open onOpenChange={(o) => { if (!o) setRoomModal({ open: false, target: null }) }}>
          <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>{roomModal.target ? t('settings.rooms.modal.editTitle') : t('settings.rooms.modal.addTitle')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRoomSubmit} className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.rooms.modal.number')} *</Label>
                  <Input required value={roomForm.room_number} onChange={(e) => setRoomForm((f) => ({ ...f, room_number: e.target.value }))} placeholder="101" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.rooms.modal.type')}</Label>
                  <select value={roomForm.room_type} onChange={(e) => setRoomForm((f) => ({ ...f, room_type: e.target.value }))} className={SELECT_CLASS}>
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt} value={rt}>{t(`roomType.${rt}` as any)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.rooms.modal.floor')}</Label>
                  <Input type="number" min="1" value={roomForm.floor} onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.rooms.modal.capacity')}</Label>
                  <Input type="number" min="1" value={roomForm.capacity} onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('settings.rooms.modal.basePrice')} *</Label>
                <Input required type="number" min="0" value={roomForm.base_price} onChange={(e) => setRoomForm((f) => ({ ...f, base_price: e.target.value }))} placeholder="500000" className="h-9" />
              </div>
              {roomModal.target && (
                <div className="space-y-1">
                  <Label className="text-xs">{t('settings.rooms.modal.housekeepingStatus')}</Label>
                  <select value={roomForm.housekeeping_status} onChange={(e) => setRoomForm((f) => ({ ...f, housekeeping_status: e.target.value }))} className={SELECT_CLASS}>
                    {HK_STATUSES.map((s) => (
                      <option key={s} value={s}>{t(`roomStatus.${s}` as any)}</option>
                    ))}
                  </select>
                </div>
              )}
              {roomError && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{roomError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setRoomModal({ open: false, target: null })}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" size="lg" className="flex-1" disabled={roomSaving}>
                  {roomSaving ? t('settings.rooms.modal.submitting') : t('settings.rooms.modal.submit')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {showForm && (
        <AddUserModal
          onClose={() => setShowForm(false)}
          onCreated={(user) => { setUsers((prev) => [...prev, user]); setShowForm(false) }}
        />
      )}

      {/* Delete user confirm */}
      {deleteUserDialog && (
        <Dialog open onOpenChange={(o) => { if (!o) setDeleteUserDialog(null) }}>
          <DialogContent className="max-w-sm" showClose={false}>
            <DialogHeader>
              <DialogTitle>{t('settings.users.deleteDialog.title')}</DialogTitle>
              <DialogDescription>{t('settings.users.deleteDialog.message', { name: deleteUserDialog.full_name })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setDeleteUserDialog(null)}>{t('common.cancel')}</Button>
              <Button variant="destructive" size="lg" className="flex-1" onClick={() => handleDeleteUser(deleteUserDialog)}>{t('settings.users.deleteDialog.confirm')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset password for another user */}
      {resetPasswordUser && (
        <Dialog open onOpenChange={(o) => { if (!o) setResetPasswordUser(null) }}>
          <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>{t('settings.users.resetPasswordDialog.title', { name: resetPasswordUser.full_name })}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 p-6">
              <div className="space-y-1">
                <Label className="text-xs">{t('settings.password.newPassword')}</Label>
                <Input type="password" value={resetPwInput} onChange={(e) => setResetPwInput(e.target.value)} className="h-9" placeholder="≥ 8 ký tự" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('settings.password.confirmPassword')}</Label>
                <Input type="password" value={resetPwConfirm} onChange={(e) => setResetPwConfirm(e.target.value)} className="h-9" placeholder="Nhập lại mật khẩu" />
              </div>
              {resetPwError && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{resetPwError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setResetPasswordUser(null)}>{t('common.cancel')}</Button>
                <Button size="lg" className="flex-1" onClick={handleResetPassword} disabled={resetPwSaving}>
                  {resetPwSaving ? '...' : t('settings.password.save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Change own password */}
      {showChangePw && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowChangePw(false) }}>
          <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>{t('settings.password.changeTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 p-6">
              <div className="space-y-1">
                <Label className="text-xs">{t('settings.password.currentPassword')}</Label>
                <Input type="password" value={changePwOld} onChange={(e) => setChangePwOld(e.target.value)} className="h-9" placeholder="Mật khẩu hiện tại" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('settings.password.newPassword')}</Label>
                <Input type="password" value={changePwNew} onChange={(e) => setChangePwNew(e.target.value)} className="h-9" placeholder="≥ 8 ký tự" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('settings.password.confirmPassword')}</Label>
                <Input type="password" value={changePwConfirm} onChange={(e) => setChangePwConfirm(e.target.value)} className="h-9" placeholder="Nhập lại mật khẩu" />
              </div>
              {changePwError && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{changePwError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setShowChangePw(false)}>{t('common.cancel')}</Button>
                <Button size="lg" className="flex-1" onClick={handleChangePassword} disabled={changePwSaving}>
                  {changePwSaving ? '...' : t('settings.password.save')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  )
}
