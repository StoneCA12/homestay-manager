import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { Bike, BikeRental, Booking, Payment } from '../../types'
import { bikesApi, bookingsApi } from '../../services/api'
import { formatDate, formatVND } from '../../utils/format'
import ReceiptPrint from '../print/ReceiptPrint'
import OD1Print from '../print/OD1Print'
import ConfirmationPrint from '../print/ConfirmationPrint'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-muted text-muted-foreground',
  CANCELLED:   'bg-red-100 text-red-600',
  NO_SHOW:     'bg-amber-100 text-amber-700',
}

const METHOD_ICON: Record<string, string> = {
  CASH:          '💵',
  BANK_TRANSFER: '🏦',
  OTA_COLLECTED: '🌐',
}

const SELECT_CLASS =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function nightCount(checkIn: string, checkOut: string): number {
  return Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
  )
}

interface Props {
  booking: Booking
  onClose: () => void
  onEdit: (b: Booking) => void
  onAction: (b: Booking, action: string) => void
  onPay: (b: Booking) => void
}

export default function BookingDetailModal({ booking: initialBooking, onClose, onEdit, onAction, onPay }: Props) {
  const { t } = useTranslation()
  const [booking, setBooking] = useState<Booking>(initialBooking)
  const [payments, setPayments] = useState<Payment[]>([])
  const [bikeRentals, setBikeRentals] = useState<BikeRental[]>([])
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
  const [availableBikes, setAvailableBikes] = useState<Bike[]>([])
  const [addBikeId, setAddBikeId] = useState('')
  const [addStartDate, setAddStartDate] = useState(initialBooking.check_in_date)
  const [addEndDate, setAddEndDate] = useState(initialBooking.check_out_date)
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    Promise.all([
      bookingsApi.getById(booking.id),
      bookingsApi.getPayments(booking.id),
      bikesApi.listRentals({ booking_id: booking.id }),
    ]).then(([fresh, pmts, rentals]) => {
      setBooking(fresh)
      setPayments(pmts)
      setBikeRentals(rentals)
    }).catch(() => {}).finally(() => setLoadingPayments(false))
  }, [booking.id])

  const nights      = nightCount(booking.check_in_date, booking.check_out_date)
  const outstanding = Number(booking.total_price) - Number(booking.collected_amount)
  const isActive    = booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN'
  const isTerminal  = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(booking.status)

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
    setAddSaving(true); setAddError('')
    try {
      const rental = await bikesApi.createRental({
        bike_id: Number(addBikeId),
        booking_id: booking.id,
        start_date: addStartDate,
        end_date: addEndDate,
      })
      setBikeRentals((prev) => [...prev, rental])
      setShowAddBikeRental(false)
    } catch (e: any) {
      setAddError(e?.response?.data?.detail ?? 'Lỗi tạo thuê xe')
    } finally {
      setAddSaving(false)
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
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[booking.status] ?? 'bg-muted text-muted-foreground')}>
                {t(`status.${booking.status}` as any)}
              </span>
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
            <Row label="Tổng tiền">
              <span className="font-semibold text-foreground">{formatVND(booking.total_price)}</span>
            </Row>
            <Row label="Đã thu">
              <span className="font-semibold text-emerald-600">{formatVND(booking.collected_amount)}</span>
            </Row>
            {outstanding > 0 && (
              <Row label="Còn lại">
                <span className="font-bold text-red-600">{formatVND(outstanding)}</span>
              </Row>
            )}
            {outstanding === 0 && (
              <Row label="">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">✓ Đã thanh toán đủ</span>
              </Row>
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
                  <div key={p.id} className="flex items-start gap-3 rounded-lg bg-background px-3 py-2.5">
                    <span className="mt-0.5 text-base">{METHOD_ICON[p.method] ?? '💰'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">{formatVND(p.amount)}</span>
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
                  <select value={addBikeId} onChange={(e) => setAddBikeId(e.target.value)} className={cn(SELECT_CLASS, 'bg-card')}>
                    <option value="">-- Chọn xe --</option>
                    {availableBikes.filter((b) => b.status !== 'MAINTENANCE').map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.plate_number ? ` (${b.plate_number})` : ''} — {formatVND(b.daily_rate)}/ngày
                        {b.status === 'RENTED' ? ' ⚠' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Ngày nhận</p>
                      <Input type="date" value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} className="h-9 bg-card" />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Ngày trả</p>
                      <Input type="date" value={addEndDate} onChange={(e) => setAddEndDate(e.target.value)} className="h-9 bg-card" />
                    </div>
                  </div>
                  {selectedAddBike && (
                    <p className="text-xs font-medium text-blue-700">
                      {addDays} ngày × {formatVND(selectedAddBike.daily_rate)} = <strong>{formatVND(addPreview)}</strong>
                    </p>
                  )}
                  {addError && <p className="text-xs text-destructive">{addError}</p>}
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

          {/* Notes */}
          {booking.notes && (
            <Section title="Ghi chú">
              <p className="text-sm leading-relaxed text-muted-foreground">{booking.notes}</p>
            </Section>
          )}
        </div>

        {/* Actions footer */}
        <div className="flex-shrink-0 space-y-2 border-t border-border px-5 pb-5 pt-3">
          {/* Primary actions — active bookings only */}
          {!isTerminal && (
            <div className="flex flex-wrap gap-2">
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
            </div>
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
