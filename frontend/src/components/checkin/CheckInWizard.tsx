import { Fragment, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Sparkles, X } from 'lucide-react'
import type { Booking, Payment, Room } from '../../types'
import { bookingsApi, roomsApi } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import { formatDate, formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseConflict, extractErrorMessage, type ConflictDetail } from '../../lib/conflictParser'
import { resolveCheckInWarnings, resolveRoomWarnings } from '../../lib/bookingWarnings'
import ConflictAlert from '../bookings/ConflictAlert'
import WarningBanner from '../bookings/WarningBanner'
import StepIndicator from './StepIndicator'

const STEPS = [
  { label: 'Xác nhận khách' },
  { label: 'Phân phòng' },
  { label: 'Thanh toán' },
  { label: 'Chìa khóa' },
  { label: 'Hoàn tất' },
]

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'OTA_COLLECTED', label: 'OTA thu' },
]

interface WizardState {
  step: 1 | 2 | 3 | 4
  selectedRoomId: string
  paymentAmount: string
  paymentMethod: string
  keyIssued: boolean
}

const wizardKey = (id: number) => `checkin_wizard_${id}`

function loadSaved(bookingId: number): WizardState | null {
  try {
    const raw = localStorage.getItem(wizardKey(bookingId))
    if (raw) return JSON.parse(raw) as WizardState
  } catch {}
  return null
}

interface Props {
  booking: Booking
  rooms: Room[]
  onComplete: (updated: Booking) => void
  onClose: () => void
}

export default function CheckInWizard({ booking, rooms, onComplete, onClose }: Props) {
  const { showToast } = useToast()
  const saved = useMemo(() => loadSaved(booking.id), [booking.id])

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(saved?.step ?? 1)
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    saved?.selectedRoomId ?? (booking.room_id ? String(booking.room_id) : ''),
  )
  const [paymentAmount, setPaymentAmount] = useState<string>(saved?.paymentAmount ?? '')
  const [paymentMethod, setPaymentMethod] = useState<string>(saved?.paymentMethod ?? 'CASH')
  const [keyIssued, setKeyIssued] = useState<boolean>(saved?.keyIssued ?? false)
  const [error, setError] = useState('')
  const [completing, setCompleting] = useState(false)
  const [roomConflict, setRoomConflict] = useState<ConflictDetail | null>(null)
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [suggesting, setSuggesting] = useState(false)

  const handleSuggest = async () => {
    setSuggesting(true)
    try {
      const suggested = await roomsApi.suggest(booking.check_in_date, booking.check_out_date, booking.room_id ? undefined : undefined)
      if (suggested) {
        setSelectedRoomId(String(suggested.id))
        setRoomConflict(null)
        setError('')
      }
    } finally {
      setSuggesting(false)
    }
  }

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === Number(selectedRoomId)),
    [rooms, selectedRoomId],
  )
  const nights = Math.max(
    1,
    Math.round(
      (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) /
        86_400_000,
    ),
  )
  const outstanding = Number(booking.total_price) - Number(booking.collected_amount)
  const isRoomOccupied = selectedRoom?.display_status === 'OCCUPIED'

  const checkInWarnings = useMemo(
    () => resolveCheckInWarnings(booking, selectedRoom),
    [booking, selectedRoom],
  )
  const roomWarnings = useMemo(() => resolveRoomWarnings(selectedRoom), [selectedRoom])

  // Persist wizard state to localStorage (except step 5 — clear on completion)
  useEffect(() => {
    if (step < 5) {
      const state: WizardState = { step: step as any, selectedRoomId, paymentAmount, paymentMethod, keyIssued }
      localStorage.setItem(wizardKey(booking.id), JSON.stringify(state))
    } else {
      localStorage.removeItem(wizardKey(booking.id))
    }
  }, [step, selectedRoomId, paymentAmount, paymentMethod, keyIssued, booking.id])

  // Fetch payments after check-in completion
  useEffect(() => {
    if (step === 5 && completedBooking) {
      bookingsApi.getPayments(completedBooking.id).then(setPayments).catch(() => showToast('Không thể tải lịch sử thanh toán.', 'error'))
    }
  }, [step, completedBooking, showToast])

  const goNext = () => {
    setError('')
    if (step === 2) {
      if (!selectedRoomId) { setError('Vui lòng chọn phòng'); return }
      if (isRoomOccupied && !roomConflict) {
        setError('Phòng đang có khách — chọn phòng khác')
        return
      }
    }
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5)
  }

  const goBack = () => {
    setError('')
    if (step > 1 && step < 5) setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)
  }

  const handleComplete = async () => {
    if (!keyIssued) { setError('Vui lòng xác nhận đã trao chìa khóa trước khi hoàn tất'); return }
    setError('')
    setCompleting(true)
    try {
      const roomNum = selectedRoomId ? Number(selectedRoomId) : undefined
      let updated = await bookingsApi.updateStatus(booking.id, 'check_in', roomNum)

      if (paymentAmount && Number(paymentAmount) > 0) {
        try {
          updated = await bookingsApi.addPayment(booking.id, {
            amount: Number(paymentAmount),
            method: paymentMethod,
            notes: 'Thu khi nhận phòng',
          })
        } catch {
          // check-in succeeded; payment failure is non-fatal
        }
      }

      setCompletedBooking(updated)
      setStep(5)
    } catch (e: unknown) {
      const parsed = parseConflict(e)
      if (parsed) {
        setRoomConflict(parsed)
        setStep(2) // send user back to room step with conflict shown
      } else {
        setError(extractErrorMessage(e))
      }
    } finally {
      setCompleting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
  const labelCls = 'mb-1 block text-xs font-semibold text-muted-foreground'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div
        className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Nhận phòng</h2>
            <p className="text-xs text-muted-foreground">
              {booking.guest_name} · P.{booking.room_number ?? '?'}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng" className="text-muted-foreground">
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>

        {/* Step indicator */}
        <div className="flex-shrink-0 border-b px-5 py-3">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Step 1: Verify Guest ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Xác nhận thông tin khách</h3>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {(([
                  ['Họ tên', booking.guest_name],
                  ['Điện thoại', booking.guest_phone ?? '—'],
                  ['Loại giấy tờ', booking.guest_id_type ?? '—'],
                  ['Số giấy tờ', booking.guest_id_number ?? '—'],
                  ['Số khách', String(booking.num_guests)],
                  ['Nhận phòng', formatDate(booking.check_in_date)],
                  ['Trả phòng', formatDate(booking.check_out_date)],
                  ['Số đêm', String(nights)],
                  ['Nguồn', booking.ota_source],
                  ...(booking.booking_ref ? [['Mã đặt phòng', booking.booking_ref]] : []),
                ] as [string, string][]).map(([label, value]) => (
                  <Fragment key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium text-foreground">{value}</dd>
                  </Fragment>
                )))}
              </dl>

              {checkInWarnings.length > 0 && (
                <WarningBanner warnings={checkInWarnings} />
              )}

              {booking.notes && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <span className="font-semibold">Ghi chú: </span>{booking.notes}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Room Assignment ── */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Phân phòng</h3>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="checkin-room" className={labelCls}>Phòng *</label>
                  <select
                    id="checkin-room"
                    value={selectedRoomId}
                    onChange={(e) => { setSelectedRoomId(e.target.value); setRoomConflict(null); setError('') }}
                    className={inputCls}
                  >
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        P.{r.room_number}
                        {r.display_status === 'OCCUPIED' ? ' 🚫 Đang có khách' : ''}
                        {r.housekeeping_status !== 'AVAILABLE' ? ` (${r.housekeeping_status === 'DIRTY' ? 'Chưa dọn' : r.housekeeping_status === 'CLEANING' ? 'Đang dọn' : 'Tạm ngừng'})` : ''}
                        {r.next_booking_date ? ` · tiếp: ${r.next_booking_date}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggest}
                  disabled={suggesting}
                  className="mb-[2px] shrink-0 gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {suggesting ? 'Đang tìm…' : 'Gợi ý'}
                </Button>
              </div>

              {/* Hard block: room occupied */}
              {selectedRoom && isRoomOccupied && !roomConflict && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-700">
                    🚫 Phòng {selectedRoom.room_number} đang có khách lưu trú
                  </p>
                  <p className="mt-0.5 text-xs text-red-600">
                    Vui lòng chọn phòng khác hoặc kiểm tra lại lịch trống
                  </p>
                </div>
              )}

              {/* Conflict alert (returned from API on failed check-in attempt) */}
              {roomConflict && (
                <ConflictAlert
                  conflict={roomConflict}
                  onSelectRoom={(roomId) => { setSelectedRoomId(String(roomId)); setRoomConflict(null) }}
                />
              )}

              {/* Non-blocking room warnings */}
              {selectedRoom && !isRoomOccupied && roomWarnings.length > 0 && (
                <WarningBanner warnings={roomWarnings} key={selectedRoomId} />
              )}
            </div>
          )}

          {/* ── Step 3: Payment ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Thanh toán</h3>

              {/* Payment summary card */}
              <div className="rounded-xl border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng tiền phòng</span>
                  <span className="font-semibold">{formatVND(booking.total_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Đã nhận (đặt cọc)</span>
                  <span className="font-semibold text-emerald-600">{formatVND(booking.collected_amount)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold text-foreground">Còn lại</span>
                  <span className={cn('font-bold', outstanding > 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {formatVND(Math.max(0, outstanding))}
                  </span>
                </div>
              </div>

              {outstanding <= 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Khách đã thanh toán đầy đủ
                </div>
              )}

              {outstanding > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">Thu thêm ngay bây giờ (không bắt buộc)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="checkin-payment-amount" className={labelCls}>Số tiền (VND)</label>
                      <Input
                        id="checkin-payment-amount"
                        type="number"
                        min="0"
                        max={outstanding}
                        placeholder={String(Math.round(outstanding))}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label htmlFor="checkin-payment-method" className={labelCls}>Hình thức</label>
                      <select
                        id="checkin-payment-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className={inputCls}
                        style={{ height: '36px' }}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {paymentAmount && Number(paymentAmount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sau khi thu: còn lại{' '}
                      <strong>{formatVND(Math.max(0, outstanding - Number(paymentAmount)))}</strong>
                    </p>
                  )}
                  {!paymentAmount && (
                    <WarningBanner
                      warnings={[{
                        id: 'SKIP_PAYMENT',
                        icon: '💰',
                        message: `Bỏ qua — khách còn nợ ${formatVND(outstanding)}`,
                        action: 'Nhắc thu tiền khi trả phòng',
                        severity: 'info',
                      }]}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Key Issuance ── */}
          {step === 4 && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-foreground">Bàn giao chìa khóa</h3>

              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-5xl">
                  🔑
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    Phòng {selectedRoom?.room_number ?? booking.room_number ?? '—'}
                  </p>
                  <p className="text-sm text-muted-foreground">{booking.guest_name}</p>
                </div>
              </div>

              {/* Check-in summary */}
              <div className="rounded-xl border bg-muted/20 p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nhận phòng</span>
                  <span className="font-medium">{formatDate(booking.check_in_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trả phòng</span>
                  <span className="font-medium">{formatDate(booking.check_out_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số đêm</span>
                  <span className="font-medium">{nights}</span>
                </div>
              </div>

              {/* Key issuance checkbox */}
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-primary/30 bg-primary/5 p-3 transition-colors hover:bg-primary/10">
                <input
                  type="checkbox"
                  checked={keyIssued}
                  onChange={(e) => { setKeyIssued(e.target.checked); setError('') }}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium text-foreground">
                  Đã trao chìa khóa phòng {selectedRoom?.room_number ?? booking.room_number ?? '—'} cho khách
                </span>
              </label>
            </div>
          )}

          {/* ── Step 5: Completion ── */}
          {step === 5 && completedBooking && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-emerald-700">Đã nhận phòng!</h2>
                <p className="text-sm text-muted-foreground">
                  {completedBooking.guest_name} · Phòng {selectedRoom?.room_number ?? completedBooking.room_number}
                </p>
              </div>

              {/* Summary card */}
              <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
                {[
                  ['Khách', completedBooking.guest_name],
                  ['Phòng', `${selectedRoom?.room_number ?? completedBooking.room_number ?? '—'}`],
                  ['Nhận phòng', formatDate(completedBooking.check_in_date)],
                  ['Trả phòng', formatDate(completedBooking.check_out_date)],
                  ['Số đêm', String(nights)],
                  ['Đã thu tổng', formatVND(completedBooking.collected_amount)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-foreground">{value}</span>
                  </div>
                ))}
                {Number(completedBooking.total_price) > Number(completedBooking.collected_amount) && (
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold text-red-600">Còn nợ</span>
                    <span className="font-bold text-red-600">
                      {formatVND(Number(completedBooking.total_price) - Number(completedBooking.collected_amount))}
                    </span>
                  </div>
                )}
              </div>

              {payments.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Lịch sử thanh toán</p>
                  {payments.map((p) => (
                    <div key={p.id} className="flex justify-between rounded-lg border bg-muted/20 px-3 py-1.5 text-xs">
                      <span className="text-muted-foreground">{new Date(p.paid_at).toLocaleDateString('vi-VN')}</span>
                      <span className="font-medium">{formatVND(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 px-5 pb-2">
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex-shrink-0 border-t px-5 pb-5 pt-3">
          {step < 5 ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={step === 1 ? onClose : goBack}
                className="min-w-[80px]"
              >
                {step === 1 ? 'Đóng' : 'Quay lại'}
              </Button>
              {step < 4 ? (
                <Button onClick={goNext} className="flex-1">
                  Tiếp tục →
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={completing || !keyIssued}
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {completing ? 'Đang xử lý...' : '✓ Hoàn tất nhận phòng'}
                </Button>
              )}
            </div>
          ) : (
            <Button
              onClick={() => onComplete(completedBooking!)}
              className="w-full"
            >
              Đóng
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
