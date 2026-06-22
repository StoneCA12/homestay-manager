import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '../../services/api'
import type { Booking, OTASource, Room } from '../../types'

const OTA_SOURCES: OTASource[] = ['AGODA', 'BOOKING_COM', 'TRAVELOKA', 'DIRECT']

const EMPTY: FormState = {
  room_id: '', guest_name: '', guest_phone: '', check_in_date: '', check_out_date: '',
  num_guests: 1, ota_source: 'DIRECT', total_price: '', booking_ref: '', notes: '',
}

interface FormState {
  room_id: string
  guest_name: string
  guest_phone: string
  check_in_date: string
  check_out_date: string
  num_guests: number
  ota_source: string
  total_price: string
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

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const created = await bookingsApi.create({
        room_id: Number(form.room_id),
        guest_name: form.guest_name,
        guest_phone: form.guest_phone || undefined,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        num_guests: form.num_guests,
        ota_source: form.ota_source,
        total_price: Number(form.total_price),
        booking_ref: form.booking_ref || undefined,
        notes: form.notes || undefined,
      })
      onCreated(created)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to create booking.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">{t('bookingForm.title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.room')} *</label>
              <select required value={form.room_id} onChange={set('room_id')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{t('bookingForm.selectRoom')}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number} ({r.room_type})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.otaSource')}</label>
              <select value={form.ota_source} onChange={set('ota_source')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {OTA_SOURCES.map((s) => (
                  <option key={s} value={s}>{t(`ota.${s}` as any)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.guestName')} *</label>
              <input required value={form.guest_name} onChange={set('guest_name')} placeholder="Full name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.guestPhone')}</label>
              <input value={form.guest_phone} onChange={set('guest_phone')} placeholder="+84..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.checkIn')} *</label>
              <input required type="date" value={form.check_in_date} onChange={set('check_in_date')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.checkOut')} *</label>
              <input required type="date" value={form.check_out_date} onChange={set('check_out_date')} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.totalPrice')} *</label>
              <input required type="number" min="0" value={form.total_price} onChange={set('total_price')} placeholder="500000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.bookingRef')}</label>
              <input value={form.booking_ref} onChange={set('booking_ref')} placeholder="OTA confirmation #" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.notes')}</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional notes" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
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
