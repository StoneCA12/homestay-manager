import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '../../services/api'
import type { Booking, Payment, PaymentMethod } from '../../types'
import { formatDate, formatVND } from '../../utils/format'

const METHOD_BADGE: Record<PaymentMethod, string> = {
  CASH:          'bg-green-100 text-green-700',
  BANK_TRANSFER: 'bg-blue-100 text-blue-700',
  OTA_COLLECTED: 'bg-purple-100 text-purple-700',
}

interface Props {
  booking: Booking
  onClose: () => void
  onUpdated: (booking: Booking) => void
}

export default function PaymentModal({ booking, onClose, onUpdated }: Props) {
  const { t } = useTranslation()
  const [history, setHistory] = useState<Payment[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [isRefund, setIsRefund] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const outstanding = Number(booking.total_price) - Number(booking.collected_amount)
  const collected = Number(booking.collected_amount)
  const canCharge = !['CANCELLED', 'NO_SHOW'].includes(booking.status)

  useEffect(() => {
    bookingsApi.getPayments(booking.id)
      .then(setHistory).catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [booking.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawAmount = Number(amount)
    if (!rawAmount || rawAmount <= 0) {
      setError('Nhập số tiền hợp lệ')
      return
    }
    if (isRefund && rawAmount > collected) {
      setError(`Không thể hoàn quá số đã thu: ${formatVND(collected)}`)
      return
    }
    setError('')
    setSaving(true)
    try {
      const updated = await bookingsApi.addPayment(booking.id, {
        amount: isRefund ? -rawAmount : rawAmount,
        method,
        notes: notes || undefined,
      })
      onUpdated(updated)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Lỗi ghi thanh toán')
      setSaving(false)
    }
  }

  const showForm = isRefund ? collected > 0 : (canCharge && outstanding > 0)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">{t('payment.title', { room: booking.room_number })}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate600 text-xl leading-none">×</button>
        </div>

        {/* Booking summary */}
        <div className="px-6 pt-4 pb-3 bg-slate-50 border-b">
          <p className="text-sm font-medium text-slate-700">{booking.guest_name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatDate(booking.check_in_date)} → {formatDate(booking.check_out_date)}
          </p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <span>{t('payment.totalPrice')}: <strong>{formatVND(booking.total_price)}</strong></span>
            <span>{t('payment.collected')}: <strong className="text-green-600">{formatVND(booking.collected_amount)}</strong></span>
            <span>{t('payment.outstanding')}: <strong className={outstanding > 0 ? 'text-red-600' : 'text-slate-400'}>
              {outstanding > 0 ? formatVND(outstanding) : `✓ ${t('payment.fullyPaid')}`}
            </strong></span>
          </div>
        </div>

        {/* Payment history */}
        <div className="px-6 pt-4 pb-3">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('payment.history')}</h3>
          {historyLoading ? (
            <p className="text-xs text-slate-400">{t('bookings.loading')}</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-400">{t('payment.noPayments')}</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {history.map((p) => {
                const isNeg = Number(p.amount) < 0
                return (
                  <div key={p.id} className="flex items-center gap-3 text-xs">
                    <span className="text-slate-400 shrink-0">{new Date(p.paid_at).toLocaleDateString('vi-VN')}</span>
                    {isNeg && (
                      <span className="px-1.5 py-0.5 rounded font-semibold shrink-0 bg-orange-100 text-orange-700">
                        Hoàn tiền
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded font-semibold shrink-0 ${METHOD_BADGE[p.method]}`}>
                      {t(`paymentMethod.${p.method}` as any)}
                    </span>
                    <span className={`font-semibold shrink-0 ${isNeg ? 'text-orange-600' : 'text-slate-800'}`}>
                      {isNeg ? `−${formatVND(Math.abs(Number(p.amount)))}` : formatVND(p.amount)}
                    </span>
                    {p.notes && <span className="text-slate-500 truncate">{p.notes}</span>}
                    {p.recorded_by_name && <span className="text-slate-400 shrink-0">{t('payment.recordedBy')} {p.recorded_by_name}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="px-6 pb-2 flex gap-2">
          <button
            onClick={() => { setIsRefund(false); setAmount(''); setError('') }}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-colors ${
              !isRefund ? 'bg-green-600 text-white border-green-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Thu tiền
          </button>
          <button
            onClick={() => { setIsRefund(true); setAmount(''); setError('') }}
            disabled={collected <= 0}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
              isRefund ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Hoàn tiền
          </button>
        </div>

        {/* Form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="px-6 pt-1 pb-5 border-t space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-2">
              {isRefund ? 'Hoàn tiền cho khách' : t('payment.addPayment')}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {isRefund ? 'Số tiền hoàn (VND)' : `${t('payment.addPayment')} (VND)`}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={isRefund ? String(collected) : String(outstanding)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    isRefund ? 'border-orange-300 focus:ring-orange-400' : 'border-slate-300 focus:ring-blue-500'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{t('payment.method')}</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {(['CASH', 'BANK_TRANSFER', 'OTA_COLLECTED'] as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{t(`paymentMethod.${m}` as any)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('bookingForm.notes')}</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isRefund ? 'Lý do hoàn tiền...' : 'Tiền cọc, thanh toán khi nhận phòng...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving}
                className={`flex-1 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors ${
                  isRefund ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'
                }`}>
                {saving ? t('payment.submitting') : (isRefund ? 'Xác nhận hoàn tiền' : t('payment.addPayment'))}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 pb-5 pt-2">
            {!canCharge && !isRefund && (
              <p className="text-xs text-slate-400 mb-3">{t('payment.cancelledNote')}</p>
            )}
            {outstanding <= 0 && !isRefund && canCharge && (
              <p className="text-xs text-green-600 font-medium mb-3">✓ {t('payment.fullyPaid')}</p>
            )}
            {isRefund && collected <= 0 && (
              <p className="text-xs text-slate-400 mb-3">Chưa có khoản thanh toán nào để hoàn</p>
            )}
            <button onClick={onClose}
              className="w-full border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
