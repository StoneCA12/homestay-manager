import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bookingsApi } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import type { Booking, Payment, PaymentMethod } from '../../types'
import { formatDate, formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const METHOD_BADGE: Record<PaymentMethod, string> = {
  CASH:          'bg-emerald-100 text-emerald-700',
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
  const { showToast } = useToast()
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
      .then(setHistory).catch(() => showToast('Không thể tải lịch sử thanh toán.', 'error'))
      .finally(() => setHistoryLoading(false))
  }, [booking.id, showToast])

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('payment.title', { room: booking.room_number })}</DialogTitle>
        </DialogHeader>

        {/* Booking summary */}
        <div className="border-b bg-muted/50 px-6 pb-3 pt-4">
          <p className="text-sm font-medium text-foreground">{booking.guest_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(booking.check_in_date)} → {formatDate(booking.check_out_date)}
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span>{t('payment.totalPrice')}: <strong>{formatVND(booking.total_price)}</strong></span>
            <span>{t('payment.collected')}: <strong className="text-emerald-600">{formatVND(booking.collected_amount)}</strong></span>
            <span>{t('payment.outstanding')}: <strong className={outstanding > 0 ? 'text-red-600' : 'text-muted-foreground'}>
              {outstanding > 0 ? formatVND(outstanding) : `✓ ${t('payment.fullyPaid')}`}
            </strong></span>
          </div>
        </div>

        {/* Payment history */}
        <div className="px-6 pb-3 pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('payment.history')}</h3>
          {historyLoading ? (
            <p className="text-xs text-muted-foreground">{t('bookings.loading')}</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('payment.noPayments')}</p>
          ) : (
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {history.map((p) => {
                const isNeg = Number(p.amount) < 0
                return (
                  <div key={p.id} className="flex items-center gap-3 text-xs">
                    <span className="shrink-0 text-muted-foreground">{new Date(p.paid_at).toLocaleDateString('vi-VN')}</span>
                    {isNeg && (
                      <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 font-semibold text-orange-700">
                        Hoàn tiền
                      </span>
                    )}
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 font-semibold', METHOD_BADGE[p.method])}>
                      {t(`paymentMethod.${p.method}` as any)}
                    </span>
                    <span className={cn('shrink-0 font-semibold', isNeg ? 'text-orange-600' : 'text-foreground')}>
                      {isNeg ? `−${formatVND(Math.abs(Number(p.amount)))}` : formatVND(p.amount)}
                    </span>
                    {p.notes && <span className="truncate text-muted-foreground">{p.notes}</span>}
                    {p.recorded_by_name && <span className="shrink-0 text-muted-foreground">{t('payment.recordedBy')} {p.recorded_by_name}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 px-6 pb-2">
          <button
            onClick={() => { setIsRefund(false); setAmount(''); setError('') }}
            className={cn(
              'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
              !isRefund ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            Thu tiền
          </button>
          <button
            onClick={() => { setIsRefund(true); setAmount(''); setError('') }}
            disabled={collected <= 0}
            className={cn(
              'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
              isRefund ? 'border-orange-500 bg-orange-500 text-white' : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            Hoàn tiền
          </button>
        </div>

        {/* Form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-3 border-t px-6 pb-5 pt-1">
            <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isRefund ? 'Hoàn tiền cho khách' : t('payment.addPayment')}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  {isRefund ? 'Số tiền hoàn (VND)' : `${t('payment.addPayment')} (VND)`}
                </Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={isRefund ? String(collected) : String(outstanding)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('payment.method')}</Label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {(['CASH', 'BANK_TRANSFER', 'OTA_COLLECTED'] as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{t(`paymentMethod.${m}` as any)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t('bookingForm.notes')}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isRefund ? 'Lý do hoàn tiền...' : 'Tiền cọc, thanh toán khi nhận phòng...'}
                className="h-9"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={saving}
                className={cn('flex-1 text-white', isRefund ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700')}
              >
                {saving ? t('payment.submitting') : (isRefund ? 'Xác nhận hoàn tiền' : t('payment.addPayment'))}
              </Button>
            </div>
          </form>
        ) : (
          <div className="px-6 pb-5 pt-2">
            {!canCharge && !isRefund && (
              <p className="mb-3 text-xs text-muted-foreground">{t('payment.cancelledNote')}</p>
            )}
            {outstanding <= 0 && !isRefund && canCharge && (
              <p className="mb-3 text-xs font-medium text-emerald-600">✓ {t('payment.fullyPaid')}</p>
            )}
            {isRefund && collected <= 0 && (
              <p className="mb-3 text-xs text-muted-foreground">Chưa có khoản thanh toán nào để hoàn</p>
            )}
            <Button variant="outline" size="lg" className="w-full" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
