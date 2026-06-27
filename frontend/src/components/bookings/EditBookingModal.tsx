import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '../../services/api'
import type { Booking, OTASource, Room } from '../../types'

const OTA_SOURCES: OTASource[] = ['AGODA', 'BOOKING_COM', 'TRAVELOKA', 'ZALO', 'DIRECT']
const ID_TYPES = ['CCCD', 'CMND', 'PASSPORT']

interface FormState {
  room_id: string
  guest_name: string
  guest_phone: string
  guest_id_type: string
  guest_id_number: string
  check_in_date: string
  check_out_date: string
  num_guests: number
  ota_source: string
  total_price: string
  booking_ref: string
  notes: string
}

interface Props {
  booking: Booking
  rooms: Room[]
  onClose: () => void
  onSaved: (booking: Booking) => void
}

export default function EditBookingModal({ booking, rooms, onClose, onSaved }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>({
    room_id: booking.room_id?.toString() ?? '',
    guest_name: booking.guest_name,
    guest_phone: booking.guest_phone ?? '',
    guest_id_type: '',
    guest_id_number: '',
    check_in_date: booking.check_in_date,
    check_out_date: booking.check_out_date,
    num_guests: booking.num_guests,
    ota_source: booking.ota_source,
    total_price: booking.total_price,
    booking_ref: booking.booking_ref ?? '',
    notes: booking.notes ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const updated = await bookingsApi.update(booking.id, {
        room_id: form.room_id ? Number(form.room_id) : null,
        guest_name: form.guest_name,
        guest_phone: form.guest_phone || undefined,
        guest_id_type: form.guest_id_type || undefined,
        guest_id_number: form.guest_id_number || undefined,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        num_guests: form.num_guests,
        ota_source: form.ota_source,
        total_price: Number(form.total_price),
        booking_ref: form.booking_ref || undefined,
        notes: form.notes || undefined,
      })
      onSaved(updated)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Không thể lưu thay đổi.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">{t('bookingForm.editTitle')} #{booking.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room + OTA source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('bookingForm.room')}</label>
              <select value={form.room_id} onChange={set('room_id')} className={inputCls}>
                <option value="">{t('bookingForm.selectRoomOptional')}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({t(`roomType.${r.room_type}` as any)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('bookingForm.otaSource')}</label>
              <select value={form.ota_source} onChange={set('ota_source')} className={inputCls}>
                {OTA_SOURCES.map((s) => (
                  <option key={s} value={s}>{t(`ota.${s}` as any)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Phone + Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('bookingForm.guestPhone')}</label>
              <input value={form.guest_phone} onChange={set('guest_phone')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('bookingForm.guestName')} *</label>
              <input required value={form.guest_name} onChange={set('guest_name')} className={inputCls} />
            </div>
          </div>

          {/* ID type + ID number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('bookingForm.idType')}</label>
              <select value={form.guest_id_type} onChange={set('guest_id_type')} className={inputCls}>
                <option value="">{t('bookingForm.selectIdType')}</option>
                {ID_TYPES.map((it) => <option key={it} value={it}>{it}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('bookingForm.idNumber')}</label>
              <input value={form.guest_id_number} onChange={set('guest_id_number')} className={inputCls} />
            </div>
          </div>

          {/* Check-in / Check-out */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('bookingForm.checkIn')} *</label>
              <input required type="date" value={form.check_in_date} onChange={set('check_in_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('bookingForm.checkOut')} *</label>
              <input required type="date" value={form.check_out_date} onChange={set('check_out_date')} className={inputCls} />
            </div>
          </div>

          {/* Price + guests */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('bookingForm.totalPrice')} *</label>
              <input required type="number" min="0" value={form.total_price} onChange={set('total_price')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('bookingForm.numGuests')}</label>
              <input type="number" min="1" value={form.num_guests}
                onChange={(e) => setForm((p) => ({ ...p, num_guests: Number(e.target.value) }))}
                className={inputCls} />
            </div>
          </div>

          {/* Booking ref */}
          <div>
            <label className={labelCls}>{t('bookingForm.bookingRef')}</label>
            <input value={form.booking_ref} onChange={set('booking_ref')} className={inputCls} />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>{t('bookingForm.notes')}</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
              {submitting ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
