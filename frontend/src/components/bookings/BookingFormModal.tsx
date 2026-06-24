import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookingsApi, guestsApi } from '../../services/api'
import type { Booking, OTASource, Room } from '../../types'

const OTA_SOURCES: OTASource[] = ['AGODA', 'BOOKING_COM', 'TRAVELOKA', 'ZALO', 'DIRECT']
const ID_TYPES = ['CCCD', 'CMND', 'PASSPORT']

const EMPTY: FormState = {
  room_id: '', guest_name: '', guest_phone: '',
  guest_id_type: '', guest_id_number: '',
  check_in_date: '', check_out_date: '',
  num_guests: 1, ota_source: 'DIRECT',
  total_price: '', deposit_amount: '', booking_ref: '', notes: '',
}

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
  deposit_amount: string
  booking_ref: string
  notes: string
}

interface Props {
  rooms: Room[]
  onClose: () => void
  onCreated: (booking: Booking) => void
}

export default function BookingFormModal({ rooms, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [autofilled, setAutofilled] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [k]: e.target.value }))
      if (k === 'guest_phone') setAutofilled(false)
    }

  const handlePhoneBlur = async () => {
    const phone = form.guest_phone.trim()
    if (phone.length < 7) return
    setLookingUp(true)
    try {
      const guest = await guestsApi.lookup(phone)
      setForm((prev) => ({
        ...prev,
        guest_name: guest.full_name,
        guest_id_type: guest.id_type ?? '',
        guest_id_number: guest.id_number ?? '',
      }))
      setAutofilled(true)
    } catch {
      // 404 = new guest, no action needed
    } finally {
      setLookingUp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const created = await bookingsApi.create({
        room_id: Number(form.room_id),
        guest_name: form.guest_name,
        guest_phone: form.guest_phone || undefined,
        guest_id_type: form.guest_id_type || undefined,
        guest_id_number: form.guest_id_number || undefined,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        num_guests: form.num_guests,
        ota_source: form.ota_source,
        total_price: Number(form.total_price),
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : undefined,
        booking_ref: form.booking_ref || undefined,
        notes: form.notes || undefined,
      })
      onCreated(created)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Không thể tạo đặt phòng.')
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
          <h2 className="text-lg font-bold text-slate-800">{t('bookingForm.title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room + OTA source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('bookingForm.room')} *</label>
              <select required value={form.room_id} onChange={set('room_id')} className={inputCls}>
                <option value="">{t('bookingForm.selectRoom')}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number} ({r.room_type})</option>)}
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

          {/* Phone (with autofill) + Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                {t('bookingForm.guestPhone')}
                {lookingUp && <span className="ml-1 text-slate-400 font-normal">{t('common.loading')}</span>}
                {autofilled && <span className="ml-1 text-green-600 font-normal">✓</span>}
              </label>
              <input
                value={form.guest_phone}
                onChange={set('guest_phone')}
                onBlur={handlePhoneBlur}
                placeholder="09xx..."
                className={inputCls}
              />
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
                {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('bookingForm.idNumber')}</label>
              <input value={form.guest_id_number} onChange={set('guest_id_number')} placeholder="012345678..." className={inputCls} />
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

          {/* Total price + Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('bookingForm.totalPrice')} *</label>
              <input required type="number" min="0" value={form.total_price} onChange={set('total_price')} placeholder="500000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('bookingForm.deposit')}</label>
              <input type="number" min="0" value={form.deposit_amount} onChange={set('deposit_amount')} placeholder="0" className={inputCls} />
            </div>
          </div>

          {/* Booking ref */}
          <div>
            <label className={labelCls}>{t('bookingForm.bookingRef')}</label>
            <input value={form.booking_ref} onChange={set('booking_ref')} placeholder="OTA confirmation #" className={inputCls} />
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
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
              {submitting ? t('bookingForm.submitting') : t('bookingForm.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
