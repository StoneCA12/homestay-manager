import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Bike, BikeRental, Booking, Payment } from '../../types'
import { bikesApi, bookingsApi } from '../../services/api'
import { formatDate, formatVND } from '../../utils/format'
import ReceiptPrint from '../print/ReceiptPrint'
import OD1Print from '../print/OD1Print'
import ConfirmationPrint from '../print/ConfirmationPrint'

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
  CANCELLED:   'bg-red-100 text-red-600',
  NO_SHOW:     'bg-yellow-100 text-yellow-700',
}

const METHOD_ICON: Record<string, string> = {
  CASH:          '💵',
  BANK_TRANSFER: '🏦',
  OTA_COLLECTED: '🌐',
}

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
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-slate-800">Đặt phòng #{booking.id}</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[booking.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {t(`status.${booking.status}` as any)}
              </span>
            </div>
            {booking.booking_ref && (
              <p className="text-xs text-slate-400 mt-1">Mã: {booking.booking_ref}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-xl ml-2 flex-shrink-0 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Dates + room */}
          <Section title="Thông tin phòng">
            <Row label="Phòng">
              {booking.room_number ? (
                <span className="font-semibold text-slate-800">Phòng {booking.room_number}</span>
              ) : (
                <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full">Chưa xếp phòng</span>
              )}
            </Row>
            <Row label="Nhận phòng"><span className="font-medium">{formatDate(booking.check_in_date)}</span></Row>
            <Row label="Trả phòng"><span className="font-medium">{formatDate(booking.check_out_date)}</span></Row>
            <Row label="Số đêm">
              <span className="font-medium">{nights} đêm</span>
            </Row>
            <Row label="Số khách">
              <span>{booking.num_guests} khách</span>
            </Row>
            <Row label="Kênh đặt">
              <span>{t(`ota.${booking.ota_source}` as any)}</span>
            </Row>
          </Section>

          {/* Guest info */}
          <Section title="Thông tin khách">
            <Row label="Họ tên">
              <span className="font-semibold text-slate-800">{booking.guest_name}</span>
            </Row>
            {booking.guest_phone && (
              <Row label="Số điện thoại">
                <a
                  href={`tel:${booking.guest_phone}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {booking.guest_phone}
                </a>
              </Row>
            )}
            {booking.guest_id_type && (
              <Row label={ID_TYPE_LABEL[booking.guest_id_type] ?? booking.guest_id_type}>
                <span className="font-mono text-slate-700">{booking.guest_id_number ?? '—'}</span>
              </Row>
            )}
          </Section>

          {/* Payment */}
          <Section title="Thanh toán">
            <Row label="Tổng tiền">
              <span className="font-semibold text-slate-800">{formatVND(booking.total_price)}</span>
            </Row>
            <Row label="Đã thu">
              <span className="font-semibold text-green-600">{formatVND(booking.collected_amount)}</span>
            </Row>
            {outstanding > 0 && (
              <Row label="Còn lại">
                <span className="font-bold text-red-600">{formatVND(outstanding)}</span>
              </Row>
            )}
            {outstanding === 0 && (
              <Row label="">
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Đã thanh toán đủ</span>
              </Row>
            )}
          </Section>

          {/* Payment history */}
          <Section title={`Lịch sử thanh toán${payments.length > 0 ? ` (${payments.length})` : ''}`}>
            {loadingPayments ? (
              <p className="text-xs text-slate-400 py-2">Đang tải...</p>
            ) : payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">Chưa có thanh toán nào</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                    <span className="text-base mt-0.5">{METHOD_ICON[p.method] ?? '💰'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-700">{formatVND(p.amount)}</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {new Date(p.paid_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t(`paymentMethod.${p.method}` as any)}
                        {p.recorded_by_name && <span className="text-slate-400"> · {p.recorded_by_name}</span>}
                      </p>
                      {p.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{p.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Bike rentals */}
          {!loadingPayments && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  🏍️ Xe máy{bikeRentals.length > 0 ? ` (${bikeRentals.length})` : ''}
                </p>
                {isActive && !showAddBikeRental && (
                  <button
                    onClick={openAddBikeRental}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    + Thêm thuê xe
                  </button>
                )}
              </div>

              {/* Inline add form */}
              {showAddBikeRental && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 space-y-2.5">
                  <p className="text-xs font-semibold text-blue-700">Thêm thuê xe máy</p>
                  <select
                    value={addBikeId}
                    onChange={(e) => setAddBikeId(e.target.value)}
                    className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
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
                      <p className="text-[10px] text-slate-500 mb-1">Ngày nhận</p>
                      <input type="date" value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)}
                        className="w-full border border-slate-300 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 mb-1">Ngày trả</p>
                      <input type="date" value={addEndDate} onChange={(e) => setAddEndDate(e.target.value)}
                        className="w-full border border-slate-300 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  {selectedAddBike && (
                    <p className="text-xs text-blue-700 font-medium">
                      {addDays} ngày × {formatVND(selectedAddBike.daily_rate)} = <strong>{formatVND(addPreview)}</strong>
                    </p>
                  )}
                  {addError && <p className="text-xs text-red-600">{addError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddBikeRental(false)}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                      Hủy
                    </button>
                    <button onClick={handleAddBikeRental} disabled={addSaving}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50">
                      {addSaving ? 'Đang lưu...' : 'Xác nhận'}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl px-4 py-1 divide-y divide-slate-100">
                {bikeRentals.length === 0 && !showAddBikeRental ? (
                  <p className="text-xs text-slate-400 py-2.5">Không có thuê xe nào</p>
                ) : (
                  bikeRentals.map((r) => {
                    const bikeOutstanding = Number(r.total_amount) - Number(r.collected_amount)
                    return (
                      <div key={r.id} className="py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{r.bike_name}</p>
                            {r.plate_number && <p className="text-xs text-slate-400 font-mono">{r.plate_number}</p>}
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            r.status === 'ACTIVE'    ? 'bg-blue-100 text-blue-700' :
                            r.status === 'RETURNED'  ? 'bg-gray-100 text-gray-600' :
                                                       'bg-red-100 text-red-600'
                          }`}>
                            {r.status === 'ACTIVE' ? 'Đang thuê' : r.status === 'RETURNED' ? 'Đã trả' : 'Đã hủy'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDate(r.start_date)} → {formatDate(r.end_date)} · {r.num_days} ngày
                        </p>
                        <div className="flex items-center justify-between mt-1 text-xs">
                          <span className="text-slate-400">{formatVND(r.daily_rate)}/ngày × {r.num_days}</span>
                          <span className="font-semibold text-slate-700">{formatVND(r.total_amount)}</span>
                        </div>
                        {bikeOutstanding > 0 ? (
                          <p className="text-xs font-semibold text-red-600 mt-0.5">Còn lại: {formatVND(bikeOutstanding)}</p>
                        ) : r.status !== 'CANCELLED' && (
                          <p className="text-xs font-semibold text-green-600 mt-0.5">✓ Đã thanh toán đủ</p>
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
              <p className="text-sm text-slate-600 leading-relaxed">{booking.notes}</p>
            </Section>
          )}
        </div>

        {/* Actions footer */}
        <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-gray-100 space-y-2">
          {/* Primary actions — active bookings only */}
          {!isTerminal && (
            <div className="flex flex-wrap gap-2">
              {booking.status === 'CONFIRMED' && (
                <button
                  onClick={() => { onClose(); onAction(booking, 'check_in') }}
                  className={`flex-1 min-w-[100px] text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                    booking.room_id
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-orange-400 hover:bg-orange-500 text-white'
                  }`}
                >
                  Nhận phòng
                </button>
              )}
              {booking.status === 'CHECKED_IN' && (
                <button
                  onClick={() => { onClose(); onAction(booking, 'check_out') }}
                  className="flex-1 min-w-[100px] text-sm font-semibold py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                >
                  Trả phòng
                </button>
              )}
              {isActive && (
                <button
                  onClick={() => { onClose(); onPay(booking) }}
                  className="flex-1 min-w-[100px] text-sm font-semibold py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Thu tiền
                </button>
              )}
              {isActive && (
                <button
                  onClick={() => { onClose(); onEdit(booking) }}
                  className="flex-1 min-w-[100px] text-sm font-medium py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                >
                  Sửa
                </button>
              )}
              {booking.status === 'CHECKED_IN' && !showLateCheckout && (
                <button
                  onClick={() => { setShowLateCheckout(true); setLateError('') }}
                  className="w-full text-xs font-medium py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors"
                >
                  🕐 Phụ thu trả phòng muộn
                </button>
              )}
            </div>
          )}

          {/* Late checkout inline form */}
          {showLateCheckout && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700">Phụ thu trả phòng muộn</p>
              <input
                type="number"
                placeholder="Số tiền phụ thu (VND)"
                value={lateAmount}
                onChange={(e) => setLateAmount(e.target.value)}
                className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                type="text"
                placeholder="Ghi chú (không bắt buộc)"
                value={lateNotes}
                onChange={(e) => setLateNotes(e.target.value)}
                className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {lateError && <p className="text-xs text-red-600">{lateError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLateCheckout(false)}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleLateCheckout}
                  disabled={lateSaving}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {lateSaving ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          )}
          {/* Print actions — always available */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirmation(true)}
              className="flex-1 text-xs font-medium py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              📄 Xác nhận phòng
            </button>
            <button
              onClick={() => setShowReceipt(true)}
              className="flex-1 text-xs font-medium py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              🖨️ Biên nhận
            </button>
            <button
              onClick={() => setShowOD1(true)}
              className="flex-1 text-xs font-medium py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              📋 Tạm trú
            </button>
          </div>
        </div>
      </div>

      {/* Print overlays */}
      {showReceipt && (
        <ReceiptPrint
          booking={booking}
          payments={payments}
          bikeRentals={bikeRentals}
          onClose={() => setShowReceipt(false)}
        />
      )}
      {showOD1 && (
        <OD1Print
          booking={booking}
          onClose={() => setShowOD1(false)}
        />
      )}
      {showConfirmation && (
        <ConfirmationPrint
          booking={booking}
          onClose={() => setShowConfirmation(false)}
        />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="bg-slate-50 rounded-xl px-4 py-1 divide-y divide-slate-100">
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-3 min-h-[40px]">
      {label && <span className="text-sm text-slate-500 flex-shrink-0 w-32">{label}</span>}
      <div className="flex-1 text-right text-sm text-slate-700">{children}</div>
    </div>
  )
}
