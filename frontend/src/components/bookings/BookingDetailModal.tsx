import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { Bike, BikeRental, Booking, BookingLog, Payment, Room } from '../../types'
import { bikesApi, bookingsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate, formatVND } from '../../utils/format'
import { resolveCheckInWarnings, resolveCheckOutWarnings, resolveBikeWarnings } from '../../lib/bookingWarnings'
import { parseConflict, extractErrorMessage, type ConflictDetail } from '../../lib/conflictParser'
import ConflictAlert from './ConflictAlert'
import ReceiptPrint from '../print/ReceiptPrint'
import OD1Print from '../print/OD1Print'
import ConfirmationPrint from '../print/ConfirmationPrint'
import BookingStatusBadge from './BookingStatusBadge'
import WarningBanner from './WarningBanner'
import InternalNotesFeed from '../notes/InternalNotesFeed'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

const METHOD_ICON: Record<string, string> = {
  CASH:          '💵',
  BANK_TRANSFER: '🏦',
  OTA_COLLECTED: '🌐',
}

const SELECT_CLASS =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

const PAYMENT_STATE_CONFIG: Record<string, { label: string; cls: string }> = {
  unpaid:          { label: 'Chưa thanh toán',  cls: 'bg-zinc-100 text-zinc-600' },
  deposit_paid:    { label: 'Đã đặt cọc',       cls: 'bg-amber-100 text-amber-700' },
  partially_paid:  { label: 'Trả một phần',      cls: 'bg-blue-100 text-blue-700' },
  paid:            { label: 'Đã thanh toán đủ',  cls: 'bg-emerald-100 text-emerald-700' },
  refunded:        { label: 'Đã hoàn tiền',      cls: 'bg-purple-100 text-purple-700' },
}

function PaymentStateBadge({ state }: { state: string }) {
  const cfg = PAYMENT_STATE_CONFIG[state] ?? { label: state, cls: 'bg-zinc-100 text-zinc-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function nightCount(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
  )
}

interface Props {
  booking: Booking
  rooms?: Room[]
  onClose: () => void
  onEdit: (b: Booking) => void
  onAction: (b: Booking, action: string) => void
  onPay: (b: Booking) => void
  onStatusChanged?: (b: Booking) => void
  onArchived?: (b: Booking) => void
  onRestored?: (b: Booking) => void
}

export default function BookingDetailModal({ booking: initialBooking, rooms = [], onClose, onEdit, onAction, onPay, onStatusChanged, onArchived, onRestored }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canViewLogs = user?.role === 'OWNER' || user?.role === 'ADMIN'
  const [booking, setBooking] = useState<Booking>(initialBooking)
  const [payments, setPayments] = useState<Payment[]>([])
  const [bikeRentals, setBikeRentals] = useState<BikeRental[]>([])
  const [logs, setLogs] = useState<BookingLog[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [showAddBikeRental, setShowAddBikeRental] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [showOD1, setShowOD1] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showLateCheckout, setShowLateCheckout] = useState(false)
  const [lateAmount, setLateAmount] = useState('')
  const [lateNotes, setLateNotes] = useState('')
  const [lateSaving, setLateSaving] = useState(false)
  const [lateError, setLateError] = useState('')
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeDescription, setChargeDescription] = useState('')
  const [chargeSaving, setChargeSaving] = useState(false)
  const [chargeError, setChargeError] = useState('')
  const [showExtend, setShowExtend] = useState(false)
  const [extendDays, setExtendDays] = useState('1')
  const [extendPrice, setExtendPrice] = useState('')
  const [extendSaving, setExtendSaving] = useState(false)
  const [extendError, setExtendError] = useState('')
  const [extendConflict, setExtendConflict] = useState<ConflictDetail | null>(null)
  const [availableBikes, setAvailableBikes] = useState<Bike[]>([])
  const [addBikeId, setAddBikeId] = useState('')
  const [addStartDate, setAddStartDate] = useState(initialBooking.check_in_date)
  const [addEndDate, setAddEndDate] = useState(initialBooking.check_out_date)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addConflict, setAddConflict] = useState<ConflictDetail | null>(null)

  // Void payment state
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidSaving, setVoidSaving] = useState(false)
  const [voidError, setVoidError] = useState('')

  // Archive / cancel / restore state
  const [cancelPending, setCancelPending] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreConflict, setRestoreConflict] = useState<ConflictDetail | null>(null)

  useEffect(() => {
    const fetches: Promise<any>[] = [
      bookingsApi.getById(booking.id),
      bookingsApi.getPayments(booking.id),
      bikesApi.listRentals({ booking_id: booking.id }),
    ]
    if (canViewLogs) fetches.push(bookingsApi.getLogs(booking.id))

    Promise.all(fetches).then(([fresh, pmts, rentals, logEntries]) => {
      setBooking(fresh)
      setPayments(pmts)
      setBikeRentals(rentals)
      if (logEntries) setLogs(logEntries)
    }).catch(() => {}).finally(() => setLoadingPayments(false))
  }, [booking.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleVoidPayment = async () => {
    if (!voidTarget) return
    if (!voidReason.trim()) { setVoidError('Vui lòng nhập lý do hủy'); return }
    setVoidSaving(true)
    setVoidError('')
    try {
      const updated = await bookingsApi.voidPayment(booking.id, voidTarget.id, voidReason.trim())
      setBooking(updated)
      const pmts = await bookingsApi.getPayments(booking.id)
      setPayments(pmts)
      setVoidTarget(null)
      setVoidReason('')
    } catch (e: any) {
      setVoidError(e.response?.data?.detail ?? 'Lỗi hủy khoản thu')
    } finally {
      setVoidSaving(false)
    }
  }

  const nights      = nightCount(booking.check_in_date, booking.check_out_date)
  const isActive    = booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN'
  const isTerminal  = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(booking.status)

  // total_price already includes room + extras + bike rental cost; bike payments are
  // still collected via their own ledger, so combine both to know the true remaining balance.
  const activeBikeRentals = bikeRentals.filter((r) => r.status !== 'CANCELLED')
  const bikeCollected = activeBikeRentals.reduce((s, r) => s + Number(r.collected_amount), 0)
  const combinedCollected = Number(booking.collected_amount) + bikeCollected
  const combinedOutstanding = Number(booking.total_price) - combinedCollected
  const isFullyPaid = combinedOutstanding <= 0

  const currentRoom = useMemo(
    () => rooms.find((r) => r.id === booking.room_id) ?? null,
    [rooms, booking.room_id],
  )
  const checkInWarnings = useMemo(
    () => booking.status === 'CONFIRMED' ? resolveCheckInWarnings(booking, currentRoom) : [],
    [booking, currentRoom],
  )
  const checkOutWarnings = useMemo(
    () => booking.status === 'CHECKED_IN' ? resolveCheckOutWarnings(booking) : [],
    [booking],
  )

  const ID_TYPE_LABEL: Record<string, string> = {
    CCCD: 'CCCD', CMND: 'CMND', PASSPORT: 'Hộ chiếu',
  }

  const openAddBikeRental = () => {
    if (availableBikes.length === 0) {
      bikesApi.listBikes().then(setAvailableBikes).catch(() => {})
    }
    setAddBikeId('')
    setAddStartDate(booking.check_in_date)
    setAddEndDate(booking.check_out_date)
    setAddError('')
    setShowAddBikeRental(true)
  }

  const handleAddBikeRental = async () => {
    if (!addBikeId) { setAddError('Vui lòng chọn xe'); return }
    if (addEndDate < addStartDate) { setAddError('Ngày trả phải sau ngày nhận'); return }
    setAddSaving(true); setAddError(''); setAddConflict(null)
    try {
      const rental = await bikesApi.createRental({
        bike_id: Number(addBikeId),
        booking_id: booking.id,
        start_date: addStartDate,
        end_date: addEndDate,
      })
      setBikeRentals((prev) => [...prev, rental])
      setShowAddBikeRental(false)
    } catch (e: unknown) {
      const parsed = parseConflict(e)
      if (parsed) { setAddConflict(parsed); setAddError('') }
      else { setAddError(extractErrorMessage(e)); setAddConflict(null) }
    } finally {
      setAddSaving(false)
    }
  }

  const handleCancelConfirm = async () => {
    setCancelSaving(true)
    setCancelError('')
    try {
      const updated = await bookingsApi.updateStatus(booking.id, 'cancel', undefined, cancelReason.trim() || undefined)
      setBooking(updated)
      setCancelPending(false)
      setCancelReason('')
      onStatusChanged?.(updated)
    } catch (e: unknown) {
      setCancelError(extractErrorMessage(e))
    } finally {
      setCancelSaving(false)
    }
  }

  const handleArchive = async () => {
    setArchiving(true)
    try {
      const updated = await bookingsApi.archive(booking.id)
      setBooking(updated)
      onArchived?.(updated)
    } catch {
      // archive failures are rare; surface via future global error handling
    } finally {
      setArchiving(false)
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    setRestoreConflict(null)
    try {
      const updated = await bookingsApi.restore(booking.id)
      setBooking(updated)
      onRestored?.(updated)
    } catch (e: unknown) {
      const parsed = parseConflict(e)
      if (parsed) setRestoreConflict(parsed)
    } finally {
      setRestoring(false)
    }
  }

  const addDays = Math.max(1, Math.round(
    (new Date(addEndDate).getTime() - new Date(addStartDate).getTime()) / 86_400_000
  ))
  const selectedAddBike = availableBikes.find((b) => b.id === Number(addBikeId))
  const addPreview = selectedAddBike ? Number(selectedAddBike.daily_rate) * addDays : 0

  const handleLateCheckout = async () => {
    const amt = Number(lateAmount)
    if (!amt || amt <= 0) { setLateError('Nhập số tiền phụ thu'); return }
    setLateSaving(true); setLateError('')
    try {
      const updated = await bookingsApi.addLateCheckout(booking.id, { amount: amt, notes: lateNotes || undefined })
      setBooking(updated)
      setShowLateCheckout(false)
      setLateAmount(''); setLateNotes('')
    } catch (e: any) {
      setLateError(e?.response?.data?.detail ?? 'Lỗi thêm phụ thu')
    } finally {
      setLateSaving(false)
    }
  }

  const handleAddCharge = async () => {
    const amt = Number(chargeAmount)
    if (!amt || amt <= 0) { setChargeError('Nhập số tiền phụ phí'); return }
    if (!chargeDescription.trim()) { setChargeError('Nhập nội dung phụ phí'); return }
    setChargeSaving(true); setChargeError('')
    try {
      const updated = await bookingsApi.addCharge(booking.id, { amount: amt, description: chargeDescription.trim() })
      setBooking(updated)
      setShowAddCharge(false)
      setChargeAmount(''); setChargeDescription('')
    } catch (e: any) {
      setChargeError(e?.response?.data?.detail ?? 'Lỗi thêm phụ phí')
    } finally {
      setChargeSaving(false)
    }
  }

  const handleExtend = async () => {
    const days = Number(extendDays)
    const price = Number(extendPrice)
    if (!days || days <= 0) { setExtendError('Nhập số đêm gia hạn'); return }
    if (!price || price <= 0) { setExtendError('Nhập giá gia hạn'); return }
    setExtendSaving(true); setExtendError(''); setExtendConflict(null)
    try {
      const updated = await bookingsApi.extendStay(booking.id, { extra_days: days, price })
      setBooking(updated)
      setShowExtend(false)
      setExtendDays('1'); setExtendPrice('')
    } catch (e: unknown) {
      const parsed = parseConflict(e)
      if (parsed) { setExtendConflict(parsed); setExtendError('') }
      else { setExtendError(extractErrorMessage(e)); setExtendConflict(null) }
    } finally {
      setExtendSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-border px-5 pb-4 pt-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-foreground">Đặt phòng #{booking.id}</h2>
              <BookingStatusBadge status={booking.status} className="px-2.5 py-1" />
            </div>
            {booking.booking_ref && (
              <p className="mt-1 text-xs text-muted-foreground">Mã: {booking.booking_ref}</p>
            )}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="ml-2 shrink-0 text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">

          {/* Dates + room */}
          <Section title="Thông tin phòng">
            <Row label="Phòng">
              {booking.room_number ? (
                <span className="font-semibold text-foreground">Phòng {booking.room_number}</span>
              ) : (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">Chưa xếp phòng</span>
              )}
            </Row>
            <Row label="Nhận phòng"><span className="font-medium">{formatDate(booking.check_in_date)}</span></Row>
            <Row label="Trả phòng"><span className="font-medium">{formatDate(booking.check_out_date)}</span></Row>
            <Row label="Số đêm"><span className="font-medium">{nights} đêm</span></Row>
            <Row label="Số khách"><span>{booking.num_guests} khách</span></Row>
            <Row label="Kênh đặt"><span>{t(`ota.${booking.ota_source}` as any)}</span></Row>
          </Section>

          {/* Guest info */}
          <Section title="Thông tin khách">
            <Row label="Họ tên">
              <span className="font-semibold text-foreground">{booking.guest_name}</span>
            </Row>
            {booking.guest_phone && (
              <Row label="Số điện thoại">
                <a href={`tel:${booking.guest_phone}`} className="font-medium text-primary hover:underline">
                  {booking.guest_phone}
                </a>
              </Row>
            )}
            {booking.guest_id_type && (
              <Row label={ID_TYPE_LABEL[booking.guest_id_type] ?? booking.guest_id_type}>
                <span className="font-mono text-foreground">{booking.guest_id_number ?? '—'}</span>
              </Row>
            )}
          </Section>

          {/* Payment */}
          <Section title="Thanh toán">
            {isFullyPaid ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                ✓ Đã thanh toán đầy đủ
              </div>
            ) : (
              <>
                <Row label="Trạng thái">
                  <PaymentStateBadge state={booking.payment_state} />
                </Row>
                <Row label="Tổng tiền">
                  <span className="font-semibold text-foreground">{formatVND(booking.total_price)}</span>
                </Row>
                <Row label="Đã thu">
                  <span className="font-semibold text-emerald-600">{formatVND(combinedCollected)}</span>
                </Row>
                <Row label="Còn lại">
                  <span className="font-bold text-red-600">{formatVND(combinedOutstanding)}</span>
                </Row>
              </>
            )}
          </Section>

          {/* Payment history */}
          <Section title={`Lịch sử thanh toán${payments.length > 0 ? ` (${payments.length})` : ''}`}>
            {loadingPayments ? (
              <p className="py-2 text-xs text-muted-foreground">Đang tải...</p>
            ) : payments.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">Chưa có thanh toán nào</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="rounded-lg bg-background px-3 py-2.5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-base">{Number(p.amount) < 0 ? '↩️' : (METHOD_ICON[p.method] ?? '💰')}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={cn('text-sm font-semibold', Number(p.amount) < 0 ? 'text-red-600' : 'text-foreground')}>
                            {Number(p.amount) < 0 ? '−' : ''}{formatVND(Math.abs(Number(p.amount)))}
                          </span>
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(p.paid_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t(`paymentMethod.${p.method}` as any)}
                          {p.recorded_by_name && <span className="text-muted-foreground/70"> · {p.recorded_by_name}</span>}
                        </p>
                        {p.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">{p.notes}</p>}
                      </div>
                      {Number(p.amount) > 0 && isActive && (
                        <button
                          onClick={() => { setVoidTarget(p); setVoidReason(''); setVoidError('') }}
                          className="mt-0.5 shrink-0 text-xs text-muted-foreground/60 hover:text-red-500"
                          title="Hủy khoản thu này"
                        >
                          Hủy
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Bike rentals */}
          {!loadingPayments && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  🏍️ Xe máy{bikeRentals.length > 0 ? ` (${bikeRentals.length})` : ''}
                </p>
                {isActive && !showAddBikeRental && (
                  <Button variant="ghost" size="sm" onClick={openAddBikeRental} className="text-primary hover:text-primary">
                    + Thêm thuê xe
                  </Button>
                )}
              </div>

              {/* Inline add form */}
              {showAddBikeRental && (
                <div className="mb-3 space-y-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-700">Thêm thuê xe máy</p>
                  <select value={addBikeId} onChange={(e) => { setAddBikeId(e.target.value); setAddConflict(null) }} className={cn(SELECT_CLASS, 'bg-card')}>
                    <option value="">-- Chọn xe --</option>
                    {availableBikes.filter((b) => b.status !== 'MAINTENANCE').map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.plate_number ? ` (${b.plate_number})` : ''} — {formatVND(b.daily_rate)}/ngày
                        {b.status === 'RENTED' ? ' ⚠' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedAddBike && (
                    <WarningBanner warnings={resolveBikeWarnings(selectedAddBike)} key={selectedAddBike.id} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Ngày nhận</p>
                      <Input type="date" value={addStartDate} onChange={(e) => { setAddStartDate(e.target.value); setAddConflict(null) }} className="h-9 bg-card" />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Ngày trả</p>
                      <Input type="date" value={addEndDate} onChange={(e) => { setAddEndDate(e.target.value); setAddConflict(null) }} className="h-9 bg-card" />
                    </div>
                  </div>
                  {selectedAddBike && (
                    <p className="text-xs font-medium text-blue-700">
                      {addDays} ngày × {formatVND(selectedAddBike.daily_rate)} = <strong>{formatVND(addPreview)}</strong>
                    </p>
                  )}
                  {addConflict ? (
                    <ConflictAlert
                      conflict={addConflict}
                      onSelectBike={(bikeId) => { setAddBikeId(String(bikeId)); setAddConflict(null) }}
                    />
                  ) : addError ? (
                    <p className="text-xs text-destructive">{addError}</p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAddBikeRental(false)}>Hủy</Button>
                    <Button size="sm" className="flex-1" onClick={handleAddBikeRental} disabled={addSaving}>
                      {addSaving ? 'Đang lưu...' : 'Xác nhận'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-border rounded-xl bg-background px-4 py-1">
                {bikeRentals.length === 0 && !showAddBikeRental ? (
                  <p className="py-2.5 text-xs text-muted-foreground">Không có thuê xe nào</p>
                ) : (
                  bikeRentals.map((r) => {
                    const bikeOutstanding = Number(r.total_amount) - Number(r.collected_amount)
                    return (
                      <div key={r.id} className="py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{r.bike_name}</p>
                            {r.plate_number && <p className="font-mono text-xs text-muted-foreground">{r.plate_number}</p>}
                          </div>
                          <span className={cn(
                            'flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                            r.status === 'ACTIVE'   ? 'bg-blue-100 text-blue-700' :
                            r.status === 'RETURNED' ? 'bg-muted text-muted-foreground' :
                                                      'bg-red-100 text-red-600'
                          )}>
                            {r.status === 'ACTIVE' ? 'Đang thuê' : r.status === 'RETURNED' ? 'Đã trả' : 'Đã hủy'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(r.start_date)} → {formatDate(r.end_date)} · {r.num_days} ngày
                        </p>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{formatVND(r.daily_rate)}/ngày × {r.num_days}</span>
                          <span className="font-semibold text-foreground">{formatVND(r.total_amount)}</span>
                        </div>
                        {bikeOutstanding > 0 ? (
                          <p className="mt-0.5 text-xs font-semibold text-red-600">Còn lại: {formatVND(bikeOutstanding)}</p>
                        ) : r.status !== 'CANCELLED' && (
                          <p className="mt-0.5 text-xs font-semibold text-emerald-600">✓ Đã thanh toán đủ</p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Public booking notes (from booking form) */}
          {booking.notes && (
            <Section title="Ghi chú đặt phòng">
              <p className="text-sm leading-relaxed text-muted-foreground">{booking.notes}</p>
            </Section>
          )}

          {/* Internal staff notes on this booking */}
          <Section title="Ghi chú nội bộ — Đặt phòng">
            <InternalNotesFeed
              entityType="BOOKING"
              entityId={booking.id}
              userRole={user?.role ?? 'RECEPTIONIST'}
            />
          </Section>

          {/* Internal notes on the guest */}
          <Section title={`Ghi chú nội bộ — Khách: ${booking.guest_name}`}>
            <InternalNotesFeed
              entityType="GUEST"
              entityId={booking.guest_id}
              userRole={user?.role ?? 'RECEPTIONIST'}
              allowedCategories={['RECEPTION', 'OWNER']}
            />
          </Section>

          {/* Activity log — admin/owner only */}
          {canViewLogs && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Lịch sử hoạt động{logs.length > 0 ? ` (${logs.length})` : ''}
              </p>
              {loadingPayments ? (
                <p className="py-2 text-xs text-muted-foreground">Đang tải...</p>
              ) : logs.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">Chưa có hoạt động nào</p>
              ) : (
                <ol className="relative border-l border-border ml-2 space-y-0">
                  {logs.map((entry) => (
                    <li key={entry.id} className="pl-4 pb-3 last:pb-0">
                      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground/40" />
                      <p className="text-xs font-medium text-foreground leading-snug">{entry.description}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString('vi-VN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                        {entry.created_by_name && <span> · {entry.created_by_name}</span>}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Actions footer */}
        <div className="flex-shrink-0 space-y-2 border-t border-border px-5 pb-5 pt-3">

          {/* Restore conflict — shown when restore re-detects a room overlap */}
          {restoreConflict && (
            <ConflictAlert conflict={restoreConflict} />
          )}

          {/* Restore button — archived or terminal bookings */}
          {(booking.is_archived || booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') && canViewLogs && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleRestore}
              disabled={restoring}
              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              {restoring ? 'Đang khôi phục...' : '↩ Khôi phục đặt phòng'}
            </Button>
          )}

          {/* Inline cancel form — replaces action buttons when active */}
          {cancelPending && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-700">Hủy đặt phòng — Lý do (không bắt buộc)</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Khách yêu cầu hủy, thay đổi kế hoạch..."
                rows={2}
                className="w-full resize-none rounded-lg border border-red-200 bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              {cancelError && <p className="text-xs text-destructive">{cancelError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { setCancelPending(false); setCancelReason(''); setCancelError('') }}>
                  Quay lại
                </Button>
                <Button size="sm" onClick={handleCancelConfirm} disabled={cancelSaving} className="flex-1 bg-red-600 text-white hover:bg-red-700">
                  {cancelSaving ? 'Đang hủy...' : 'Xác nhận hủy'}
                </Button>
              </div>
            </div>
          )}

          {/* Primary actions — non-terminal, non-archived, not in cancel form */}
          {!isTerminal && !booking.is_archived && !cancelPending && (
            <>
              <WarningBanner
                warnings={booking.status === 'CONFIRMED' ? checkInWarnings : checkOutWarnings}
                key={`w-${booking.status}-${booking.room_id ?? 0}`}
              />
              <div className="flex flex-wrap gap-2">
                {booking.status === 'PENDING' && (
                  <Button
                    size="lg"
                    onClick={() => { onClose(); onAction(booking, 'confirm') }}
                    className="min-w-[100px] flex-1 bg-blue-500 text-white hover:bg-blue-600"
                  >
                    Xác nhận đặt phòng
                  </Button>
                )}
                {booking.status === 'CONFIRMED' && (
                  <Button
                    size="lg"
                    onClick={() => { onClose(); onAction(booking, 'check_in') }}
                    className={cn('min-w-[100px] flex-1 text-white', booking.room_id ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-orange-400 hover:bg-orange-500')}
                  >
                    Nhận phòng
                  </Button>
                )}
                {booking.status === 'CHECKED_IN' && (
                  <Button
                    size="lg"
                    onClick={() => { onClose(); onAction(booking, 'check_out') }}
                    className="min-w-[100px] flex-1 bg-blue-500 text-white hover:bg-blue-600"
                  >
                    Trả phòng
                  </Button>
                )}
                {isActive && (
                  <Button variant="secondary" size="lg" onClick={() => { onClose(); onPay(booking) }} className="min-w-[100px] flex-1">
                    Thu tiền
                  </Button>
                )}
                {isActive && (
                  <Button variant="outline" size="lg" onClick={() => { onClose(); onEdit(booking) }} className="min-w-[100px] flex-1">
                    Sửa
                  </Button>
                )}
                {booking.status === 'CHECKED_IN' && !showLateCheckout && (
                  <button
                    onClick={() => { setShowLateCheckout(true); setLateError('') }}
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                  >
                    🕐 Phụ thu trả phòng muộn
                  </button>
                )}
                {booking.status === 'CHECKED_IN' && !showAddCharge && (
                  <button
                    onClick={() => { setShowAddCharge(true); setChargeError('') }}
                    className="w-full rounded-xl border border-purple-300 bg-purple-50 py-2 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"
                  >
                    🧺 Thêm phụ phí (giặt ủi, nước uống...)
                  </button>
                )}
                {booking.status === 'CHECKED_IN' && !showExtend && (
                  <button
                    onClick={() => { setShowExtend(true); setExtendError(''); setExtendConflict(null) }}
                    className="w-full rounded-xl border border-blue-300 bg-blue-50 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    📅 Gia hạn lưu trú
                  </button>
                )}
                {/* Cancel trigger — shown for all cancellable statuses */}
                {booking.status !== 'CHECKED_OUT' && (
                  <button
                    onClick={() => { setCancelPending(true); setCancelError('') }}
                    className="w-full rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    Hủy đặt phòng
                  </button>
                )}
              </div>
            </>
          )}

          {/* Late checkout inline form */}
          {showLateCheckout && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-700">Phụ thu trả phòng muộn</p>
              <Input type="number" placeholder="Số tiền phụ thu (VND)" value={lateAmount} onChange={(e) => setLateAmount(e.target.value)} className="h-9 bg-card" />
              <Input type="text" placeholder="Ghi chú (không bắt buộc)" value={lateNotes} onChange={(e) => setLateNotes(e.target.value)} className="h-9 bg-card" />
              {lateError && <p className="text-xs text-destructive">{lateError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowLateCheckout(false)}>Hủy</Button>
                <Button size="sm" onClick={handleLateCheckout} disabled={lateSaving} className="flex-1 bg-amber-600 text-white hover:bg-amber-700">
                  {lateSaving ? 'Đang lưu...' : 'Xác nhận'}
                </Button>
              </div>
            </div>
          )}

          {/* Add room charge inline form */}
          {showAddCharge && (
            <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50 p-3">
              <p className="text-xs font-semibold text-purple-700">Thêm phụ phí</p>
              <Input type="number" placeholder="Số tiền (VND)" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} className="h-9 bg-card" />
              <Input type="text" placeholder="Nội dung (VD: giặt ủi, nước uống...)" value={chargeDescription} onChange={(e) => setChargeDescription(e.target.value)} className="h-9 bg-card" />
              {chargeError && <p className="text-xs text-destructive">{chargeError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAddCharge(false)}>Hủy</Button>
                <Button size="sm" onClick={handleAddCharge} disabled={chargeSaving} className="flex-1 bg-purple-600 text-white hover:bg-purple-700">
                  {chargeSaving ? 'Đang lưu...' : 'Xác nhận'}
                </Button>
              </div>
            </div>
          )}

          {/* Extend stay inline form */}
          {showExtend && (
            <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">Gia hạn lưu trú</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[10px] text-muted-foreground">Số đêm thêm</p>
                  <Input type="number" min="1" value={extendDays} onChange={(e) => { setExtendDays(e.target.value); setExtendConflict(null) }} className="h-9 bg-card" />
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-muted-foreground">Giá gia hạn (VND)</p>
                  <Input type="number" placeholder="0" value={extendPrice} onChange={(e) => setExtendPrice(e.target.value)} className="h-9 bg-card" />
                </div>
              </div>
              {Number(extendDays) > 0 && (
                <p className="text-xs font-medium text-blue-700">
                  Checkout mới: {new Date(new Date(booking.check_out_date + 'T00:00:00').getTime() + Number(extendDays) * 86_400_000).toLocaleDateString('vi-VN')}
                </p>
              )}
              {extendConflict ? (
                <ConflictAlert conflict={extendConflict} />
              ) : extendError ? (
                <p className="text-xs text-destructive">{extendError}</p>
              ) : null}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowExtend(false)}>Hủy</Button>
                <Button size="sm" onClick={handleExtend} disabled={extendSaving} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">
                  {extendSaving ? 'Đang lưu...' : 'Xác nhận'}
                </Button>
              </div>
            </div>
          )}

          {/* Print actions — always available */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowConfirmation(true)}>
              📄 Xác nhận phòng
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowReceipt(true)}>
              🖨️ Biên nhận
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowOD1(true)}>
              📋 Tạm trú
            </Button>
          </div>

          {/* Archive — admin/owner only, for non-active bookings */}
          {canViewLogs && !booking.is_archived && booking.status !== 'CHECKED_IN' && !cancelPending && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="w-full rounded-xl border border-muted py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive/70 disabled:opacity-50"
            >
              {archiving ? 'Đang lưu trữ...' : '🗂 Lưu trữ đặt phòng'}
            </button>
          )}
        </div>
      </div>

      {/* Print overlays */}
      {showReceipt && (
        <ReceiptPrint booking={booking} payments={payments} bikeRentals={bikeRentals} onClose={() => setShowReceipt(false)} />
      )}
      {showOD1 && (
        <OD1Print booking={booking} onClose={() => setShowOD1(false)} />
      )}
      {showConfirmation && (
        <ConfirmationPrint booking={booking} onClose={() => setShowConfirmation(false)} />
      )}

      {/* Void payment confirm dialog */}
      <Dialog open={voidTarget !== null} onOpenChange={(open) => { if (!open) { setVoidTarget(null); setVoidReason(''); setVoidError('') } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hủy khoản thu</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Bạn đang hủy khoản thu{' '}
              <strong className="text-foreground">{voidTarget ? formatVND(voidTarget.amount) : ''}</strong>.
              Hành động này không thể hoàn tác.
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Lý do hủy *</label>
              <Input
                value={voidReason}
                onChange={(e) => { setVoidReason(e.target.value); setVoidError('') }}
                placeholder="Nhập lý do..."
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && voidReason.trim()) handleVoidPayment() }}
              />
            </div>
            {voidError && <p className="text-xs text-destructive">{voidError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidTarget(null); setVoidReason(''); setVoidError('') }}>
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              disabled={voidSaving || !voidReason.trim()}
              onClick={handleVoidPayment}
            >
              {voidSaving ? 'Đang hủy…' : 'Xác nhận hủy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="divide-y divide-border rounded-xl bg-background px-4 py-1">
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[40px] items-center justify-between gap-3 py-2.5">
      {label && <span className="w-32 flex-shrink-0 text-sm text-muted-foreground">{label}</span>}
      <div className="flex-1 text-right text-sm text-foreground">{children}</div>
    </div>
  )
}
