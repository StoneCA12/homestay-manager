import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/layout/Layout'
import AddUserModal from '../../components/settings/AddUserModal'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { authApi, roomsApi, settingsApi, usersApi } from '../../services/api'
import type { CommissionRate, Room, RoomType, User, UserRole } from '../../types'
import { formatVND } from '../../utils/format'

const ROLE_BADGE: Record<UserRole, string> = {
  OWNER:        'bg-purple-100 text-purple-700',
  ADMIN:        'bg-blue-100 text-blue-700',
  RECEPTIONIST: 'bg-gray-100 text-gray-600',
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

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

  return (
    <Layout>
      <div className="p-8 max-w-4xl space-y-10">
        <div>
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
                        {u.id === me?.id && <span className="ml-2 text-xs text-slate-400">(bạn)</span>}
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
                            <div className="flex flex-wrap gap-2">
                              <button
                                disabled={toggling === u.id}
                                onClick={() => handleToggle(u)}
                                className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                                  u.is_active
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                                }`}
                              >
                                {toggling === u.id ? '...' : u.is_active ? t('settings.users.deactivate') : t('settings.users.reactivate')}
                              </button>
                              <button
                                onClick={() => { setResetPasswordUser(u); setResetPwInput(''); setResetPwConfirm(''); setResetPwError('') }}
                                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                              >
                                {t('settings.users.resetPassword')}
                              </button>
                              {u.role !== 'OWNER' && (
                                <button
                                  onClick={() => setDeleteUserDialog(u)}
                                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                >
                                  {t('common.delete')}
                                </button>
                              )}
                            </div>
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

        {isOwnerOrAdmin && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{t('settings.rooms.title')}</h2>
              <button
                onClick={openAddRoom}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {t('settings.rooms.addRoom')}
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    {[
                      t('settings.rooms.table.number'),
                      t('settings.rooms.table.type'),
                      t('settings.rooms.table.floor'),
                      t('settings.rooms.table.capacity'),
                      t('settings.rooms.table.basePrice'),
                      t('settings.rooms.table.status'),
                      '',
                    ].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rooms.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-800">{r.room_number}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                          {t(`roomType.${r.room_type}` as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.floor}</td>
                      <td className="px-4 py-3 text-slate-600">{r.capacity}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{formatVND(r.base_price)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          r.housekeeping_status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                          r.housekeeping_status === 'DIRTY' ? 'bg-red-100 text-red-600' :
                          r.housekeeping_status === 'CLEANING' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {t(`roomStatus.${r.housekeeping_status}` as any)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEditRoom(r)}
                          className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                          {t('settings.rooms.editRoom')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* My account — available to all roles */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">{t('settings.myAccount.title')}</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">{me?.full_name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{me?.email}</p>
            </div>
            <button
              onClick={() => { setChangePwOld(''); setChangePwNew(''); setChangePwConfirm(''); setChangePwError(''); setShowChangePw(true) }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {t('settings.myAccount.changePassword')}
            </button>
          </div>
        </div>

        {isOwnerOrAdmin && rates.length > 0 && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-800">{t('settings.commission.title')}</h2>
              <p className="text-sm text-slate-500 mt-1">{t('settings.commission.description')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('settings.commission.source')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('settings.commission.rate')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rates.map((r) => (
                    <tr key={r.ota_source} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {OTA_LABEL[r.ota_source] ?? r.ota_source}
                      </td>
                      <td className="px-4 py-3">
                        {editingRate === r.ota_source ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={rateInput}
                              onChange={(e) => setRateInput(e.target.value)}
                              className="border border-slate-300 rounded px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <span className="text-slate-500 text-sm">%</span>
                          </div>
                        ) : (
                          <span className="text-slate-700 font-mono">
                            {(Number(r.rate) * 100).toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingRate === r.ota_source ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingRate(null)}
                              className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                            >
                              {t('settings.commission.cancel')}
                            </button>
                            <button
                              disabled={savingRate}
                              onClick={() => saveRate(r.ota_source)}
                              className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {savingRate ? t('settings.commission.saving') : t('settings.commission.save')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditRate(r)}
                            className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            {t('settings.commission.edit')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {roomModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-slate-800">
                {roomModal.target ? t('settings.rooms.modal.editTitle') : t('settings.rooms.modal.addTitle')}
              </h2>
              <button onClick={() => setRoomModal({ open: false, target: null })} className="text-slate-400 hover:text-slate-600 text-xl">&#215;</button>
            </div>
            <form onSubmit={handleRoomSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('settings.rooms.modal.number')} *</label>
                  <input
                    required
                    value={roomForm.room_number}
                    onChange={(e) => setRoomForm((f) => ({ ...f, room_number: e.target.value }))}
                    placeholder="101"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('settings.rooms.modal.type')}</label>
                  <select
                    value={roomForm.room_type}
                    onChange={(e) => setRoomForm((f) => ({ ...f, room_type: e.target.value }))}
                    className={inputCls}
                  >
                    {ROOM_TYPES.map((rt) => (
                      <option key={rt} value={rt}>{t(`roomType.${rt}` as any)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>{t('settings.rooms.modal.floor')}</label>
                  <input
                    type="number"
                    min="1"
                    value={roomForm.floor}
                    onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('settings.rooms.modal.capacity')}</label>
                  <input
                    type="number"
                    min="1"
                    value={roomForm.capacity}
                    onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('settings.rooms.modal.basePrice')} *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={roomForm.base_price}
                  onChange={(e) => setRoomForm((f) => ({ ...f, base_price: e.target.value }))}
                  placeholder="500000"
                  className={inputCls}
                />
              </div>
              {roomModal.target && (
                <div>
                  <label className={labelCls}>{t('settings.rooms.modal.housekeepingStatus')}</label>
                  <select
                    value={roomForm.housekeeping_status}
                    onChange={(e) => setRoomForm((f) => ({ ...f, housekeeping_status: e.target.value }))}
                    className={inputCls}
                  >
                    {HK_STATUSES.map((s) => (
                      <option key={s} value={s}>{t(`roomStatus.${s}` as any)}</option>
                    ))}
                  </select>
                </div>
              )}
              {roomError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{roomError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRoomModal({ open: false, target: null })}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={roomSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  {roomSaving ? t('settings.rooms.modal.submitting') : t('settings.rooms.modal.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <AddUserModal
          onClose={() => setShowForm(false)}
          onCreated={(user) => { setUsers((prev) => [...prev, user]); setShowForm(false) }}
        />
      )}

      {/* Delete user confirm */}
      {deleteUserDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800 mb-2">{t('settings.users.deleteDialog.title')}</h3>
            <p className="text-sm text-slate-600 mb-5">
              {t('settings.users.deleteDialog.message', { name: deleteUserDialog.full_name })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUserDialog(null)}
                className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDeleteUser(deleteUserDialog)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                {t('settings.users.deleteDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password for another user */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-slate-800">
                {t('settings.users.resetPasswordDialog.title', { name: resetPasswordUser.full_name })}
              </h2>
              <button onClick={() => setResetPasswordUser(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>{t('settings.password.newPassword')}</label>
                <input type="password" value={resetPwInput} onChange={(e) => setResetPwInput(e.target.value)}
                  className={inputCls} placeholder="≥ 8 ký tự" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.password.confirmPassword')}</label>
                <input type="password" value={resetPwConfirm} onChange={(e) => setResetPwConfirm(e.target.value)}
                  className={inputCls} placeholder="Nhập lại mật khẩu" />
              </div>
              {resetPwError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetPwError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setResetPasswordUser(null)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={handleResetPassword} disabled={resetPwSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  {resetPwSaving ? '...' : t('settings.password.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change own password */}
      {showChangePw && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-slate-800">{t('settings.password.changeTitle')}</h2>
              <button onClick={() => setShowChangePw(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>{t('settings.password.currentPassword')}</label>
                <input type="password" value={changePwOld} onChange={(e) => setChangePwOld(e.target.value)}
                  className={inputCls} placeholder="Mật khẩu hiện tại" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.password.newPassword')}</label>
                <input type="password" value={changePwNew} onChange={(e) => setChangePwNew(e.target.value)}
                  className={inputCls} placeholder="≥ 8 ký tự" />
              </div>
              <div>
                <label className={labelCls}>{t('settings.password.confirmPassword')}</label>
                <input type="password" value={changePwConfirm} onChange={(e) => setChangePwConfirm(e.target.value)}
                  className={inputCls} placeholder="Nhập lại mật khẩu" />
              </div>
              {changePwError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{changePwError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowChangePw(false)}
                  className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  {t('common.cancel')}
                </button>
                <button onClick={handleChangePassword} disabled={changePwSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  {changePwSaving ? '...' : t('settings.password.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
