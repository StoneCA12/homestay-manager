import { Fragment, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { Booking, Room } from '../../types'
import { bookingsApi, guestsApi, roomsApi } from '../../services/api'
import { formatDate, formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseConflict, extractErrorMessage, type ConflictDetail } from '../../lib/conflictParser'
import ConflictAlert from '../bookings/ConflictAlert'
import StepIndicator from '../checkin/StepIndicator'

const STEPS = [
  { label: 'Tìm phòng' },
  { label: 'Thông tin khách' },
  { label: 'Chi tiết đặt' },
  { label: 'Thanh toán' },
  { label: 'Hoàn tất' },
]

const ROOM_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả loại phòng' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'WINDOW', label: 'Window' },
  { value: 'BALCONY', label: 'Balcony' },
  { value: 'REGULAR', label: 'Regular' },
]

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
]

const ID_TYPES = ['CCCD', 'CMND', 'Passport', 'Khác']

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

function nightCount(ci: string, co: string): number {
  return Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86_400_000))
}

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
const labelCls = 'mb-1 block text-xs font-semibold text-muted-foreground'

interface Props {
  onComplete: (booking: Booking) => void
  onClose: () => void
}

export default function WalkInWizard({ onComplete, onClose }: Props) {
  const today = toISO(new Date())

  // Step 1 — room search
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDays(today, 1))
  const [roomTypeFilter, setRoomTypeFilter] = useState('')
  const [availableRooms, setAvailableRooms] = useState<Room[] | null>(null)
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  // Step 2 — guest
  const [phone, setPhone] = useState('')
  const [guestName, setGuestName] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [numGuests, setNumGuests] = useState('1')
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupDone, setLookupDone] = useState(false)

  // Step 3 — booking details
  const [totalPrice, setTotalPrice] = useState('')
  const [notes, setNotes] = useState('')

  // Step 4 — payment
  const [depositAmount, setDepositAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')

  // Navigation + async state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [conflict, setConflict] = useState<ConflictDetail | null>(null)
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null)

  const nights = useMemo(() => nightCount(checkIn, checkOut), [checkIn, checkOut])

  // Auto-fill suggested price when room is selected
  useEffect(() => {
    if (selectedRoom) {
      setTotalPrice(String(Math.round(Number(selectedRoom.base_price) * nights)))
    }
  }, [selectedRoom, nights])

  // Room availability search
  const searchRooms = async () => {
    if (checkOut <= checkIn) { setError('Ngày trả phòng phải sau ngày nhận phòng'); return }
    setError('')
    setLoadingRooms(true)
    setAvailableRooms(null)
    setSelectedRoom(null)
    try {
      const rooms = await roomsApi.available(checkIn, checkOut, roomTypeFilter || undefined)
      setAvailableRooms(rooms)
      if (rooms.length === 0) setError('Không còn phòng trống cho khoảng thời gian này')
    } catch {
      setError('Không thể tải danh sách phòng')
    } finally {
      setLoadingRooms(false)
    }
  }

  // Guest phone lookup
  const lookupGuest = async () => {
    if (!phone || lookupDone) return
    setLookingUp(true)
    try {
      const g = await guestsApi.lookup(phone)
      setGuestName(g.full_name)
      if (g.id_type) setIdType(g.id_type)
      if (g.id_number) setIdNumber(g.id_number)
      setLookupDone(true)
    } catch {
      // new guest — no pre-fill
      setLookupDone(true)
    } finally {
      setLookingUp(false)
    }
  }

  const goNext = () => {
    setError('')
    if (step === 1) {
      if (!selectedRoom) { setError('Vui lòng chọn phòng'); return }
    }
    if (step === 2) {
      if (!guestName.trim()) { setError('Vui lòng nhập tên khách'); return }
    }
    if (step === 3) {
      if (!totalPrice || Number(totalPrice) < 0) { setError('Vui lòng nhập giá phòng'); return }
    }
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4)
  }

  const goBack = () => {
    setError('')
    if (step > 1 && step < 5) setStep((s) => (s - 1) as 1 | 2 | 3 | 4)
  }

  const handleComplete = async () => {
    if (!selectedRoom) return
    setError('')
    setConflict(null)
    setSubmitting(true)
    try {
      const booking = await bookingsApi.walkIn({
        room_id: selectedRoom.id,
        guest_name: guestName.trim(),
        guest_phone: phone.trim() || undefined,
        guest_id_type: idType || undefined,
        guest_id_number: idNumber.trim() || undefined,
        check_in_date: checkIn,
        check_out_date: checkOut,
        num_guests: Number(numGuests) || 1,
        total_price: Number(totalPrice),
        deposit_amount: Number(depositAmount) || 0,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      })
      setCompletedBooking(booking)
      setStep(5)
    } catch (e: unknown) {
      const parsed = parseConflict(e)
      if (parsed) {
        setConflict(parsed)
        setStep(1) // back to room search with conflict shown
      } else {
        setError(extractErrorMessage(e))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const hkLabel: Record<string, string> = {
    DIRTY: 'Chưa dọn',
    CLEANING: 'Đang dọn',
    OUT_OF_ORDER: 'Tạm ngừng',
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div
        className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Nhận phòng trực tiếp</h2>
            <p className="text-xs text-muted-foreground">Không có đặt trước</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Step indicator */}
        <div className="flex-shrink-0 border-b px-5 py-3">
          <StepIndicator steps={STEPS} currentStep={step} />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Step 1: Find Room ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Tìm phòng trống</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Ngày nhận *</label>
                  <Input
                    type="date"
                    value={checkIn}
                    min={today}
                    onChange={(e) => {
                      setCheckIn(e.target.value)
                      if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1))
                      setAvailableRooms(null)
                      setSelectedRoom(null)
                    }}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className={labelCls}>Ngày trả *</label>
                  <Input
                    type="date"
                    value={checkOut}
                    min={addDays(checkIn, 1)}
                    onChange={(e) => { setCheckOut(e.target.value); setAvailableRooms(null); setSelectedRoom(null) }}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Loại phòng</label>
                  <select value={roomTypeFilter} onChange={(e) => setRoomTypeFilter(e.target.value)} className={inputCls}>
                    {ROOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <Button onClick={searchRooms} disabled={loadingRooms} className="whitespace-nowrap">
                  {loadingRooms ? 'Đang tìm...' : 'Tìm phòng'}
                </Button>
              </div>

              {/* Conflict alert when API rejects on final submit */}
              {conflict && (
                <ConflictAlert
                  conflict={conflict}
                  onSelectRoom={(roomId) => {
                    const found = availableRooms?.find((r) => r.id === roomId)
                    if (found) { setSelectedRoom(found); setConflict(null) }
                    else { setConflict(null); setAvailableRooms(null) } // trigger re-search
                  }}
                />
              )}

              {/* Available room cards */}
              {availableRooms && availableRooms.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {availableRooms.length} phòng trống · {nights} đêm
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {availableRooms.map((r) => {
                      const isSelected = selectedRoom?.id === r.id
                      const needsCleaning = r.housekeeping_status !== 'AVAILABLE'
                      return (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedRoom(r); setError('') }}
                          className={cn(
                            'rounded-xl border p-3 text-left transition-all',
                            isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                              : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30',
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-base font-bold text-foreground">P.{r.room_number}</span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {r.room_type} · Tầng {r.floor} · {r.capacity} khách
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {formatVND(Number(r.base_price) * nights)}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({formatVND(r.base_price)}/đêm)
                            </span>
                          </p>
                          {needsCleaning && (
                            <p className="mt-1 text-[11px] font-medium text-amber-600">
                              ⚠ {hkLabel[r.housekeeping_status] ?? r.housekeeping_status}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Guest Info ── */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Thông tin khách</h3>

              <div>
                <label className={labelCls}>Số điện thoại</label>
                <div className="flex gap-2">
                  <Input
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setLookupDone(false) }}
                    placeholder="0901234567"
                    className="h-9 flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && lookupGuest()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={lookupGuest}
                    disabled={!phone || lookingUp || lookupDone}
                    className="whitespace-nowrap"
                  >
                    {lookingUp ? '...' : lookupDone ? '✓' : 'Tra cứu'}
                  </Button>
                </div>
                {lookupDone && guestName && (
                  <p className="mt-1 text-xs text-emerald-600">Tìm thấy khách — thông tin đã được điền tự động</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Họ tên *</label>
                <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nguyễn Văn A" className="h-9" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Loại giấy tờ</label>
                  <select value={idType} onChange={(e) => setIdType(e.target.value)} className={inputCls}>
                    <option value="">-- Chọn --</option>
                    {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Số giấy tờ</label>
                  <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="123456789" className="h-9" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Số khách</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={numGuests}
                  onChange={(e) => setNumGuests(e.target.value)}
                  className="h-9 w-24"
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Booking Details ── */}
          {step === 3 && selectedRoom && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Chi tiết đặt phòng</h3>

              {/* Summary */}
              <div className="rounded-xl border bg-muted/20 p-3 text-sm space-y-1.5">
                {[
                  ['Phòng', `P.${selectedRoom.room_number} · ${selectedRoom.room_type}`],
                  ['Nhận phòng', formatDate(checkIn)],
                  ['Trả phòng', formatDate(checkOut)],
                  ['Số đêm', String(nights)],
                  ['Khách', guestName],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className={labelCls}>Tổng tiền phòng (VND) *</label>
                <Input
                  type="number"
                  min="0"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  className="h-9"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Giá gợi ý: {formatVND(Number(selectedRoom.base_price) * nights)} ({formatVND(selectedRoom.base_price)}/đêm × {nights} đêm)
                </p>
              </div>

              <div>
                <label className={labelCls}>Ghi chú</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Yêu cầu đặc biệt, ghi chú nội bộ..."
                  className={cn(inputCls, 'resize-none')}
                />
              </div>
            </div>
          )}

          {/* ── Step 4: Confirm & Payment ── */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Xác nhận và thu tiền</h3>

              {/* Booking confirmation summary */}
              {selectedRoom && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Xác nhận nhận phòng</p>
                  {([
                    ['Phòng', `P.${selectedRoom.room_number} · ${selectedRoom.room_type} · Tầng ${selectedRoom.floor}`],
                    ['Khách', guestName],
                    phone ? ['Điện thoại', phone] : null,
                    ['Nhận phòng', formatDate(checkIn)],
                    ['Trả phòng', `${formatDate(checkOut)} (${nights} đêm)`],
                    ['Tổng tiền', formatVND(totalPrice)],
                  ] as ([string, string] | null)[])
                    .filter((x): x is [string, string] => x !== null)
                    .map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                </div>
              )}

              <div className="rounded-xl border bg-muted/30 p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tổng tiền phòng</span>
                  <span className="font-bold text-foreground">{formatVND(totalPrice)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Thu ngay (không bắt buộc)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Số tiền (VND)</label>
                    <Input
                      type="number"
                      min="0"
                      max={Number(totalPrice)}
                      placeholder={totalPrice}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Hình thức</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls} style={{ height: '36px' }}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {depositAmount && Number(depositAmount) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Còn lại sau khi thu:{' '}
                    <strong>{formatVND(Math.max(0, Number(totalPrice) - Number(depositAmount)))}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === 5 && completedBooking && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-emerald-700">Nhận phòng thành công!</h2>
                <p className="text-sm text-muted-foreground">
                  {completedBooking.guest_name} · Phòng {completedBooking.room_number}
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-2 text-sm">
                {(
                  [
                    ['Mã đặt phòng', `#${completedBooking.id}`],
                    ['Khách', completedBooking.guest_name],
                    completedBooking.guest_phone ? ['Điện thoại', completedBooking.guest_phone] : null,
                    ['Phòng', `${completedBooking.room_number}`],
                    ['Nhận phòng', formatDate(completedBooking.check_in_date)],
                    ['Trả phòng', formatDate(completedBooking.check_out_date)],
                    ['Số đêm', String(nightCount(completedBooking.check_in_date, completedBooking.check_out_date))],
                    ['Tổng tiền', formatVND(completedBooking.total_price)],
                    ['Đã thu', formatVND(completedBooking.collected_amount)],
                  ] as ([string, string] | null)[]
                ).filter((x): x is [string, string] => x !== null)
                  .map(([label, value]) => (
                    <Fragment key={label}>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold text-foreground">{value}</span>
                      </div>
                    </Fragment>
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

        {/* Footer */}
        <div className="flex-shrink-0 border-t px-5 pb-5 pt-3">
          {step < 5 ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={step === 1 ? onClose : goBack} className="min-w-[80px]">
                {step === 1 ? 'Đóng' : 'Quay lại'}
              </Button>
              {step < 4 ? (
                <Button onClick={goNext} className="flex-1">
                  Tiếp tục →
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? 'Đang xử lý...' : '✓ Xác nhận nhận phòng'}
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={() => onComplete(completedBooking!)} className="w-full">
              Đóng
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
