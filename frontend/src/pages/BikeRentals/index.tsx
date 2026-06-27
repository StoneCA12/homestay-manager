import { useEffect, useState } from 'react'
import Layout from '../../components/layout/Layout'
import { bikesApi, bookingsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { Bike, BikeRental, BikeRentalReport, BikeRentalReportRow, Booking } from '../../types'
import { formatDate, formatVND } from '../../utils/format'

type Tab = 'fleet' | 'rentals' | 'report'

const BIKE_STATUS_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  AVAILABLE:   { label: 'Sẵn sàng',  badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  RENTED:      { label: 'Đang thuê', badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  MAINTENANCE: { label: 'Bảo trì',   badge: 'bg-red-100 text-red-700',     dot: 'bg-red-400'    },
}

const RENTAL_STATUS_CFG: Record<string, { label: string; badge: string }> = {
  ACTIVE:    { label: 'Đang thuê', badge: 'bg-blue-100 text-blue-700'   },
  RETURNED:  { label: 'Đã trả',   badge: 'bg-gray-100 text-gray-600'   },
  CANCELLED: { label: 'Đã hủy',   badge: 'bg-red-100 text-red-600'     },
}

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', OTA_COLLECTED: 'OTA thu hộ',
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function lastOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}
function toISO(d: Date) {
  return d.toISOString().split('T')[0]
}

// ─── Bike Card ────────────────────────────────────────────────────────────────

function BikeCard({
  bike, isAdmin,
  onEdit, onDelete,
}: {
  bike: Bike
  isAdmin: boolean
  onEdit: (b: Bike) => void
  onDelete: (b: Bike) => void
}) {
  const cfg = BIKE_STATUS_CFG[bike.status] ?? BIKE_STATUS_CFG.AVAILABLE
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-slate-800 text-base">{bike.name}</p>
          {bike.plate_number && <p className="text-xs text-slate-400 mt-0.5 font-mono">{bike.plate_number}</p>}
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.badge}`}>{cfg.label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-700">{formatVND(bike.daily_rate)}<span className="text-xs font-normal text-slate-400">/ngày</span></p>
      {bike.notes && <p className="text-xs text-slate-500 italic">{bike.notes}</p>}
      {isAdmin && (
        <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
          <button
            onClick={() => onEdit(bike)}
            className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Sửa
          </button>
          {bike.status !== 'RENTED' && (
            <button
              onClick={() => onDelete(bike)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              Xóa
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add/Edit Bike Modal ──────────────────────────────────────────────────────

function BikeFormModal({
  editing, onClose, onSaved,
}: {
  editing: Bike | null
  onClose: () => void
  onSaved: (b: Bike) => void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [plate, setPlate] = useState(editing?.plate_number ?? '')
  const [rate, setRate] = useState(editing ? String(editing.daily_rate) : '')
  const [status, setStatus] = useState(editing?.status ?? 'AVAILABLE')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim() || !rate) { setError('Vui lòng điền tên và giá thuê'); return }
    setSaving(true); setError('')
    try {
      const data = { name: name.trim(), plate_number: plate.trim() || undefined, daily_rate: Number(rate), notes: notes.trim() || undefined }
      const saved = editing
        ? await bikesApi.updateBike(editing.id, { ...data, status })
        : await bikesApi.createBike(data)
      onSaved(saved)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Lỗi lưu xe')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-800">{editing ? 'Sửa thông tin xe' : 'Thêm xe máy'}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Tên xe *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wave Alpha, Airblade..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Biển số</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="51X1-12345" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Giá thuê/ngày (VND) *</label>
            <input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="100000" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {editing && (
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Trạng thái</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="AVAILABLE">Sẵn sàng</option>
                <option value="MAINTENANCE">Bảo trì</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Ghi chú</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2.5 rounded-xl hover:bg-slate-50">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Rental Modal ─────────────────────────────────────────────────────────

function AddRentalModal({
  bikes, onClose, onSaved,
  prefilledBookingId, prefilledStart, prefilledEnd,
}: {
  bikes: Bike[]
  onClose: () => void
  onSaved: (r: BikeRental) => void
  prefilledBookingId?: number
  prefilledStart?: string
  prefilledEnd?: string
}) {
  const [bikeId, setBikeId] = useState<string>('')
  const [bookingId, setBookingId] = useState(prefilledBookingId ? String(prefilledBookingId) : '')
  const [activeBookings, setActiveBookings] = useState<Booking[]>([])
  const [startDate, setStartDate] = useState(prefilledStart ?? toISO(new Date()))
  const [endDate, setEndDate] = useState(prefilledEnd ?? toISO(new Date()))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!prefilledBookingId) {
      Promise.all([
        bookingsApi.list({ booking_status: 'CONFIRMED' }),
        bookingsApi.list({ booking_status: 'CHECKED_IN' }),
      ]).then(([confirmed, checkedIn]) => {
        setActiveBookings([...checkedIn, ...confirmed])
      }).catch(() => {})
    }
  }, [prefilledBookingId])

  const selectedBike = bikes.find((b) => b.id === Number(bikeId))
  const numDays = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000))
  const preview = selectedBike ? Number(selectedBike.daily_rate) * numDays : 0
  const availableBikes = bikes.filter((b) => b.status !== 'MAINTENANCE')

  const handleBookingSelect = (id: string) => {
    setBookingId(id)
    if (!id) return
    const b = activeBookings.find((b) => b.id === Number(id))
    if (b) { setStartDate(b.check_in_date); setEndDate(b.check_out_date) }
  }

  const handleSave = async () => {
    if (!bikeId || !bookingId || !startDate || !endDate) { setError('Vui lòng điền đầy đủ thông tin'); return }
    if (endDate < startDate) { setError('Ngày trả phải sau ngày nhận'); return }
    setSaving(true); setError('')
    try {
      const rental = await bikesApi.createRental({
        bike_id: Number(bikeId),
        booking_id: Number(bookingId),
        start_date: startDate,
        end_date: endDate,
        notes: notes.trim() || undefined,
      })
      onSaved(rental)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Lỗi tạo thuê xe')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-800">Thêm thuê xe máy</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Chọn xe *</label>
            <select value={bikeId} onChange={(e) => setBikeId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Chọn xe --</option>
              {availableBikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.plate_number ? ` (${b.plate_number})` : ''} — {formatVND(b.daily_rate)}/ngày
                  {b.status === 'RENTED' ? ' ⚠ Đang thuê' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Đặt phòng *</label>
            {prefilledBookingId ? (
              <div className="border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
                Đặt phòng #{prefilledBookingId} (đã chọn)
              </div>
            ) : (
              <select value={bookingId} onChange={(e) => handleBookingSelect(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Chọn đặt phòng --</option>
                {activeBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.room_number ? `P.${b.room_number}` : 'Chưa xếp'} — {b.guest_name} ({b.check_in_date} → {b.check_out_date})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Ngày nhận *</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Ngày trả *</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {selectedBike && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>{numDays} ngày × {formatVND(selectedBike.daily_rate)}</span>
                <span className="font-bold text-slate-800">{formatVND(preview)}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Ghi chú</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2.5 rounded-xl hover:bg-slate-50">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Tạo thuê xe'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Payment Modal ────────────────────────────────────────────────────────

function AddBikePaymentModal({
  rental, onClose, onSaved,
}: {
  rental: BikeRental
  onClose: () => void
  onSaved: (r: BikeRental) => void
}) {
  const outstanding = Number(rental.total_amount) - Number(rental.collected_amount)
  const [amount, setAmount] = useState(String(outstanding > 0 ? outstanding : ''))
  const [method, setMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { setError('Số tiền phải lớn hơn 0'); return }
    setSaving(true); setError('')
    try {
      const updated = await bikesApi.addPayment(rental.id, { amount: Number(amount), method, notes: notes.trim() || undefined })
      onSaved(updated)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Lỗi thu tiền')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-800">Thu tiền thuê xe</h2>
        <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">Xe</span><span className="font-medium">{rental.bike_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Khách</span><span className="font-medium">{rental.guest_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Phòng</span><span className="font-medium">{rental.room_number ? `P.${rental.room_number}` : '—'}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
            <span className="text-slate-500">Còn lại</span>
            <span className="font-bold text-red-600">{formatVND(outstanding)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Số tiền thu (VND)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Phương thức</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Ghi chú</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2.5 rounded-xl hover:bg-slate-50">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Thu tiền'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Rentals table row ────────────────────────────────────────────────────────

function RentalRow({
  rental, isAdmin,
  onPay, onReturn, onCancel, onExpand,
  expanded,
}: {
  rental: BikeRental
  isAdmin: boolean
  onPay: (r: BikeRental) => void
  onReturn: (r: BikeRental) => void
  onCancel: (r: BikeRental) => void
  onExpand: () => void
  expanded: boolean
}) {
  const outstanding = Number(rental.total_amount) - Number(rental.collected_amount)
  const cfg = RENTAL_STATUS_CFG[rental.status] ?? RENTAL_STATUS_CFG.ACTIVE

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={onExpand}>
        <td className="px-4 py-3">
          <p className="font-semibold text-slate-800 text-sm">{rental.bike_name}</p>
          {rental.plate_number && <p className="text-xs text-slate-400 font-mono">{rental.plate_number}</p>}
        </td>
        <td className="px-4 py-3">
          <p className="text-sm text-slate-700 font-medium">{rental.guest_name}</p>
          <p className="text-xs text-slate-400">{rental.room_number ? `Phòng ${rental.room_number}` : 'Chưa xếp phòng'}</p>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
          {formatDate(rental.start_date)} → {formatDate(rental.end_date)}
          <div className="text-slate-400">{rental.num_days} ngày</div>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-slate-700 whitespace-nowrap">{formatVND(rental.total_amount)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {outstanding > 0 ? (
            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">Còn {formatVND(outstanding)}</span>
          ) : (
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">✓ Đã đủ</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.badge}`}>{cfg.label}</span>
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1.5 flex-wrap">
            {rental.status === 'ACTIVE' && outstanding > 0 && (
              <button onClick={() => onPay(rental)} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 whitespace-nowrap">Thu tiền</button>
            )}
            {rental.status === 'ACTIVE' && (
              <button onClick={() => onReturn(rental)} className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap">Trả xe</button>
            )}
            {rental.status === 'ACTIVE' && isAdmin && (
              <button onClick={() => onCancel(rental)} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 whitespace-nowrap">Hủy</button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 pb-3 bg-slate-50">
            <div className="pl-2 border-l-2 border-blue-200">
              <p className="text-xs font-semibold text-slate-500 mb-2 mt-2 uppercase tracking-wide">
                Lịch sử thanh toán {rental.payments.length > 0 ? `(${rental.payments.length})` : '— Chưa có'}
              </p>
              {rental.payments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Chưa thu tiền</p>
              ) : (
                <div className="space-y-1.5">
                  {rental.payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="text-slate-400 w-24 flex-shrink-0">
                        {new Date(p.paid_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="font-semibold text-green-700">{formatVND(p.amount)}</span>
                      <span className="text-slate-400">{METHOD_LABEL[p.method] ?? p.method}</span>
                      {p.recorded_by_name && <span className="text-slate-400">· {p.recorded_by_name}</span>}
                      {p.notes && <span className="italic text-slate-400">— {p.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
              {rental.created_by_name && (
                <p className="text-xs text-slate-400 mt-2">
                  Tạo bởi: {rental.created_by_name} · {new Date(rental.created_at).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Report tab ───────────────────────────────────────────────────────────────

function ReportSection({
  report, loading,
}: {
  report: BikeRentalReport | null
  loading: boolean
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (loading) return <p className="text-sm text-slate-400 py-8 text-center">Đang tải...</p>
  if (!report) return null

  if (report.rows.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🏍️</p>
        <p className="text-slate-400 text-sm">Không có dữ liệu thuê xe trong kỳ này</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Doanh thu dự kiến', value: report.grand_expected, color: 'text-slate-800' },
          { label: 'Đã thu', value: report.grand_collected, color: 'text-green-600' },
          { label: 'Còn lại', value: report.grand_outstanding, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{formatVND(value)}</p>
          </div>
        ))}
      </div>

      {/* Per-booking rows */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-gray-200">
            <tr>
              {['Phòng / Khách', 'Ngày ở', 'Xe thuê', 'Dự kiến', 'Đã thu', 'Còn lại'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.rows.map((row) => (
              <ReportBookingRow
                key={row.booking_id}
                row={row}
                expanded={expandedId === row.booking_id}
                onExpand={() => setExpandedId((id) => id === row.booking_id ? null : row.booking_id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReportBookingRow({
  row, expanded, onExpand,
}: {
  row: BikeRentalReportRow
  expanded: boolean
  onExpand: () => void
}) {
  return (
    <>
      <tr className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={onExpand}>
        <td className="px-4 py-3">
          <p className="font-semibold text-slate-800">{row.room_number ? `Phòng ${row.room_number}` : 'Chưa xếp'}</p>
          <p className="text-xs text-slate-500">{row.guest_name}</p>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
          {formatDate(row.check_in_date)} → {formatDate(row.check_out_date)}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {row.rentals.map((r) => (
              <span key={r.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{r.bike_name}</span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{formatVND(row.total_expected)}</td>
        <td className="px-4 py-3 text-green-600 font-medium whitespace-nowrap">{formatVND(row.total_collected)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          {Number(row.outstanding) > 0 ? (
            <span className="font-bold text-red-600">{formatVND(row.outstanding)}</span>
          ) : (
            <span className="text-green-600 text-xs font-semibold">✓ Đủ</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-slate-50 px-6 pb-3">
            <div className="space-y-2 mt-2">
              {row.rentals.map((r) => {
                const paidForRental = Number(r.collected_amount)
                return (
                  <div key={r.id} className="flex items-center gap-4 text-xs text-slate-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <span className="font-semibold w-28 flex-shrink-0">{r.bike_name}</span>
                    <span className="text-slate-400">{formatDate(r.start_date)} → {formatDate(r.end_date)} ({r.num_days} ngày)</span>
                    <span className="ml-auto font-medium">{formatVND(r.total_amount)}</span>
                    <span className={paidForRental >= Number(r.total_amount) ? 'text-green-600' : 'text-red-600'}>
                      {paidForRental >= Number(r.total_amount) ? '✓ Đã thu' : `Còn ${formatVND(Number(r.total_amount) - paidForRental)}`}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full ${RENTAL_STATUS_CFG[r.status]?.badge ?? ''}`}>
                      {RENTAL_STATUS_CFG[r.status]?.label ?? r.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BikeRentalsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'

  const [tab, setTab] = useState<Tab>('rentals')
  const [bikes, setBikes] = useState<Bike[]>([])
  const [rentals, setRentals] = useState<BikeRental[]>([])
  const [report, setReport] = useState<BikeRentalReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMonth, setReportMonth] = useState<Date>(firstOfMonth(new Date()))

  const [showBikeForm, setShowBikeForm] = useState(false)
  const [editingBike, setEditingBike] = useState<Bike | null>(null)
  const [showAddRental, setShowAddRental] = useState(false)
  const [payRental, setPayRental] = useState<BikeRental | null>(null)
  const [expandedRentalId, setExpandedRentalId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE')
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'bike' | 'rental'; id: number; label: string } | null>(null)

  const loadBikes = () => bikesApi.listBikes().then(setBikes).catch(() => {})
  const loadRentals = () => bikesApi.listRentals(statusFilter !== 'ALL' ? { rental_status: statusFilter } : {}).then(setRentals).catch(() => {})
  const loadReport = (month: Date) => {
    setReportLoading(true)
    bikesApi.report(toISO(firstOfMonth(month)), toISO(lastOfMonth(month)))
      .then(setReport).catch(() => {}).finally(() => setReportLoading(false))
  }

  useEffect(() => { loadBikes() }, [])
  useEffect(() => { loadRentals() }, [statusFilter])
  useEffect(() => { if (tab === 'report') loadReport(reportMonth) }, [tab, reportMonth])

  const handleBikeSaved = (bike: Bike) => {
    setBikes((prev) => {
      const idx = prev.findIndex((b) => b.id === bike.id)
      return idx >= 0 ? prev.map((b) => b.id === bike.id ? bike : b) : [bike, ...prev]
    })
    setShowBikeForm(false); setEditingBike(null)
    showToast(editingBike ? 'Đã cập nhật xe' : 'Đã thêm xe mới')
  }

  const handleRentalSaved = (rental: BikeRental) => {
    setRentals((prev) => [rental, ...prev])
    loadBikes()
    setShowAddRental(false)
    showToast('Đã tạo thuê xe thành công')
  }

  const handlePaymentSaved = (updated: BikeRental) => {
    setRentals((prev) => prev.map((r) => r.id === updated.id ? updated : r))
    setPayRental(null)
    showToast('Đã ghi nhận thanh toán')
  }

  const handleReturn = async (rental: BikeRental) => {
    try {
      const updated = await bikesApi.returnRental(rental.id)
      setRentals((prev) => prev.map((r) => r.id === updated.id ? updated : r))
      loadBikes()
      showToast('Đã trả xe')
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Lỗi trả xe', 'error')
    }
  }

  const handleConfirmedDelete = async () => {
    if (!confirmDelete) return
    try {
      if (confirmDelete.type === 'bike') {
        await bikesApi.deleteBike(confirmDelete.id)
        setBikes((prev) => prev.filter((b) => b.id !== confirmDelete.id))
        showToast('Đã xóa xe')
      } else {
        await bikesApi.cancelRental(confirmDelete.id)
        setRentals((prev) => prev.filter((r) => r.id !== confirmDelete.id))
        loadBikes()
        showToast('Đã hủy thuê xe')
      }
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? 'Lỗi thao tác', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  const TAB_LABELS: Record<Tab, string> = { fleet: 'Đội xe', rentals: 'Cho thuê', report: 'Báo cáo' }

  return (
    <Layout>
      <div className="p-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🏍️ Cho thuê xe máy</h1>
            <p className="text-sm text-slate-500 mt-1">Quản lý đội xe và doanh thu thuê xe</p>
          </div>
          <div className="flex gap-2">
            {tab === 'fleet' && isAdmin && (
              <button onClick={() => { setEditingBike(null); setShowBikeForm(true) }} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                + Thêm xe
              </button>
            )}
            {tab === 'rentals' && (
              <button onClick={() => setShowAddRental(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                + Thêm thuê xe
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-6">
          {(['fleet', 'rentals', 'report'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── Fleet tab ── */}
        {tab === 'fleet' && (
          bikes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">🏍️</p>
              <p className="text-slate-500 text-sm mb-4">Chưa có xe nào. Thêm xe để bắt đầu.</p>
              {isAdmin && <button onClick={() => setShowBikeForm(true)} className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700">Thêm xe đầu tiên</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {bikes.map((b) => (
                <BikeCard
                  key={b.id} bike={b} isAdmin={isAdmin}
                  onEdit={(bike) => { setEditingBike(bike); setShowBikeForm(true) }}
                  onDelete={(bike) => setConfirmDelete({ type: 'bike', id: bike.id, label: bike.name })}
                />
              ))}
            </div>
          )
        )}

        {/* ── Rentals tab ── */}
        {tab === 'rentals' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {[['ALL', 'Tất cả'], ['ACTIVE', 'Đang thuê'], ['RETURNED', 'Đã trả'], ['CANCELLED', 'Đã hủy']].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${statusFilter === v ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {rentals.length === 0 ? (
              <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-slate-400 text-sm">Không có thuê xe nào</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr>
                      {['Xe', 'Khách / Phòng', 'Thời gian', 'Tổng tiền', 'Thanh toán', 'Trạng thái', 'Thao tác'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rentals.map((r) => (
                      <RentalRow
                        key={r.id} rental={r} isAdmin={isAdmin}
                        onPay={setPayRental}
                        onReturn={handleReturn}
                        onCancel={(rental) => setConfirmDelete({ type: 'rental', id: rental.id, label: `${rental.bike_name} — ${rental.guest_name}` })}
                        onExpand={() => setExpandedRentalId((id) => id === r.id ? null : r.id)}
                        expanded={expandedRentalId === r.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Report tab ── */}
        {tab === 'report' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setReportMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">‹</button>
              <span className="text-base font-bold text-slate-800 min-w-[180px] text-center capitalize">
                {reportMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setReportMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500">›</button>
            </div>
            <ReportSection report={report} loading={reportLoading} />
          </div>
        )}
      </div>

      {/* Modals */}
      {(showBikeForm || editingBike) && (
        <BikeFormModal editing={editingBike} onClose={() => { setShowBikeForm(false); setEditingBike(null) }} onSaved={handleBikeSaved} />
      )}
      {showAddRental && (
        <AddRentalModal bikes={bikes} onClose={() => setShowAddRental(false)} onSaved={handleRentalSaved} />
      )}
      {payRental && (
        <AddBikePaymentModal rental={payRental} onClose={() => setPayRental(null)} onSaved={handlePaymentSaved} />
      )}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-600 mb-6">Bạn có chắc muốn {confirmDelete.type === 'bike' ? 'xóa xe' : 'hủy thuê xe'} <strong>{confirmDelete.label}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-slate-300 text-slate-700 text-sm py-2.5 rounded-xl hover:bg-slate-50">Hủy</button>
              <button onClick={handleConfirmedDelete} className="flex-1 bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-red-700">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
