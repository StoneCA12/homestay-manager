import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import { bikesApi, bookingsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { Bike, BikeRental, BikeRentalReport, BikeRentalReportRow, Booking } from '../../types'
import { formatDate, formatVND, toLocalISODate } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Tab = 'fleet' | 'rentals' | 'report'

const SELECT_CLASS =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

const BIKE_STATUS_CFG: Record<string, { label: string; badge: string }> = {
  AVAILABLE:   { label: 'Sẵn sàng',  badge: 'bg-emerald-100 text-emerald-700' },
  RENTED:      { label: 'Đang thuê', badge: 'bg-blue-100 text-blue-700' },
  MAINTENANCE: { label: 'Bảo trì',   badge: 'bg-red-100 text-red-700' },
}

const RENTAL_STATUS_CFG: Record<string, { label: string; badge: string }> = {
  ACTIVE:    { label: 'Đang thuê', badge: 'bg-blue-100 text-blue-700' },
  RETURNED:  { label: 'Đã trả',   badge: 'bg-muted text-muted-foreground' },
  CANCELLED: { label: 'Đã hủy',   badge: 'bg-red-100 text-red-600' },
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
  return toLocalISODate(d)
}

// ─── Bike Card ────────────────────────────────────────────────────────────────

function BikeCard({
  bike, isAdmin, onEdit, onDelete,
}: {
  bike: Bike
  isAdmin: boolean
  onEdit: (b: Bike) => void
  onDelete: (b: Bike) => void
}) {
  const cfg = BIKE_STATUS_CFG[bike.status] ?? BIKE_STATUS_CFG.AVAILABLE
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-foreground">{bike.name}</p>
          {bike.plate_number && <p className="mt-0.5 font-mono text-xs text-muted-foreground">{bike.plate_number}</p>}
        </div>
        <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', cfg.badge)}>{cfg.label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{formatVND(bike.daily_rate)}<span className="text-xs font-normal text-muted-foreground">/ngày</span></p>
      {bike.notes && <p className="text-xs italic text-muted-foreground">{bike.notes}</p>}
      {isAdmin && (
        <div className="mt-auto flex gap-2 border-t pt-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={() => onEdit(bike)}>Sửa</Button>
          {bike.status !== 'RENTED' && (
            <Button variant="ghost" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => onDelete(bike)}>Xóa</Button>
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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Sửa thông tin xe' : 'Thêm xe máy'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Tên xe *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wave Alpha, Airblade..." className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Biển số</Label>
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="51X1-12345" className="h-9 font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Giá thuê/ngày (VND) *</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="100000" className="h-9" />
          </div>
          {editing && (
            <div className="space-y-1">
              <Label className="text-xs">Trạng thái</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className={SELECT_CLASS}>
                <option value="AVAILABLE">Sẵn sàng</option>
                <option value="MAINTENANCE">Bảo trì</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Ghi chú</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" />
          </div>
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button size="lg" className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { showToast } = useToast()

  useEffect(() => {
    if (!prefilledBookingId) {
      Promise.all([
        bookingsApi.list({ booking_status: 'CONFIRMED' }),
        bookingsApi.list({ booking_status: 'CHECKED_IN' }),
      ]).then(([confirmed, checkedIn]) => {
        setActiveBookings([...checkedIn, ...confirmed])
      }).catch(() => showToast('Không thể tải danh sách đặt phòng.', 'error'))
    }
  }, [prefilledBookingId, showToast])

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Thêm thuê xe máy</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Chọn xe *</Label>
            <select value={bikeId} onChange={(e) => setBikeId(e.target.value)} className={SELECT_CLASS}>
              <option value="">-- Chọn xe --</option>
              {availableBikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.plate_number ? ` (${b.plate_number})` : ''} — {formatVND(b.daily_rate)}/ngày
                  {b.status === 'RENTED' ? ' ⚠ Đang thuê' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Đặt phòng *</Label>
            {prefilledBookingId ? (
              <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Đặt phòng #{prefilledBookingId} (đã chọn)
              </div>
            ) : (
              <select value={bookingId} onChange={(e) => handleBookingSelect(e.target.value)} className={SELECT_CLASS}>
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
            <div className="space-y-1">
              <Label className="text-xs">Ngày nhận *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ngày trả *</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
            </div>
          </div>
          {selectedBike && (
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{numDays} ngày × {formatVND(selectedBike.daily_rate)}</span>
                <span className="font-bold text-foreground">{formatVND(preview)}</span>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Ghi chú</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" />
          </div>
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button size="lg" className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo thuê xe'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Thu tiền thuê xe</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Xe</span><span className="font-medium">{rental.bike_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Khách</span><span className="font-medium">{rental.guest_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Phòng</span><span className="font-medium">{rental.room_number ? `P.${rental.room_number}` : '—'}</span></div>
          <div className="mt-1 flex justify-between border-t pt-1">
            <span className="text-muted-foreground">Còn lại</span>
            <span className="font-bold text-red-600">{formatVND(outstanding)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Số tiền thu (VND)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Phương thức</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={SELECT_CLASS}>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ghi chú</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" />
          </div>
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Hủy</Button>
          <Button size="lg" className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Thu tiền'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Rentals table row ────────────────────────────────────────────────────────

function RentalRow({
  rental, isAdmin, onPay, onReturn, onCancel, onExpand, expanded,
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
      <TableRow className="cursor-pointer" onClick={onExpand}>
        <TableCell>
          <p className="text-sm font-semibold text-foreground">{rental.bike_name}</p>
          {rental.plate_number && <p className="font-mono text-xs text-muted-foreground">{rental.plate_number}</p>}
        </TableCell>
        <TableCell>
          <p className="text-sm font-medium text-foreground">{rental.guest_name}</p>
          <p className="text-xs text-muted-foreground">{rental.room_number ? `Phòng ${rental.room_number}` : 'Chưa xếp phòng'}</p>
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(rental.start_date)} → {formatDate(rental.end_date)}
          <div className="text-muted-foreground/70">{rental.num_days} ngày</div>
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">{formatVND(rental.total_amount)}</TableCell>
        <TableCell className="whitespace-nowrap">
          {outstanding > 0 ? (
            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">Còn {formatVND(outstanding)}</span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">✓ Đã đủ</span>
          )}
        </TableCell>
        <TableCell>
          <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', cfg.badge)}>{cfg.label}</span>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1.5">
            {rental.status === 'ACTIVE' && outstanding > 0 && (
              <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => onPay(rental)}>Thu tiền</Button>
            )}
            {rental.status === 'ACTIVE' && (
              <Button variant="secondary" size="sm" onClick={() => onReturn(rental)}>Trả xe</Button>
            )}
            {rental.status === 'ACTIVE' && isAdmin && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onCancel(rental)}>Hủy</Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="bg-muted/40">
            <div className="border-l-2 border-blue-200 pl-3">
              <p className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lịch sử thanh toán {rental.payments.length > 0 ? `(${rental.payments.length})` : '— Chưa có'}
              </p>
              {rental.payments.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">Chưa thu tiền</p>
              ) : (
                <div className="space-y-1.5">
                  {rental.payments.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="w-24 flex-shrink-0 text-muted-foreground">
                        {new Date(p.paid_at).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="font-semibold text-emerald-700">{formatVND(p.amount)}</span>
                      <span>{METHOD_LABEL[p.method] ?? p.method}</span>
                      {p.recorded_by_name && <span>· {p.recorded_by_name}</span>}
                      {p.notes && <span className="italic">— {p.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
              {rental.created_by_name && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tạo bởi: {rental.created_by_name} · {new Date(rental.created_at).toLocaleDateString('vi-VN')}
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Report tab ───────────────────────────────────────────────────────────────

function ReportSection({ report, loading }: { report: BikeRentalReport | null; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Đang tải...</p>
  if (!report) return null

  if (report.rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="mb-3 text-4xl">🏍️</p>
        <p className="text-sm text-muted-foreground">Không có dữ liệu thuê xe trong kỳ này</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Doanh thu dự kiến', value: report.grand_expected, color: 'text-foreground' },
          { label: 'Đã thu', value: report.grand_collected, color: 'text-emerald-600' },
          { label: 'Còn lại', value: report.grand_outstanding, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="mb-1 text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-lg font-bold', color)}>{formatVND(value)}</p>
          </div>
        ))}
      </div>

      {/* Per-booking rows */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {['Phòng / Khách', 'Ngày ở', 'Xe thuê', 'Dự kiến', 'Đã thu', 'Còn lại'].map((h) => (
                <TableHead key={h} className="whitespace-nowrap uppercase tracking-wide">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.map((row) => (
              <ReportBookingRow
                key={row.booking_id}
                row={row}
                expanded={expandedId === row.booking_id}
                onExpand={() => setExpandedId((id) => id === row.booking_id ? null : row.booking_id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function ReportBookingRow({ row, expanded, onExpand }: { row: BikeRentalReportRow; expanded: boolean; onExpand: () => void }) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onExpand}>
        <TableCell>
          <p className="font-semibold text-foreground">{row.room_number ? `Phòng ${row.room_number}` : 'Chưa xếp'}</p>
          <p className="text-xs text-muted-foreground">{row.guest_name}</p>
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.check_in_date)} → {formatDate(row.check_out_date)}
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {row.rentals.map((r) => (
              <span key={r.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{r.bike_name}</span>
            ))}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap font-medium text-foreground">{formatVND(row.total_expected)}</TableCell>
        <TableCell className="whitespace-nowrap font-medium text-emerald-600">{formatVND(row.total_collected)}</TableCell>
        <TableCell className="whitespace-nowrap">
          {Number(row.outstanding) > 0 ? (
            <span className="font-bold text-red-600">{formatVND(row.outstanding)}</span>
          ) : (
            <span className="text-xs font-semibold text-emerald-600">✓ Đủ</span>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="bg-muted/40">
            <div className="mt-1 space-y-2">
              {row.rentals.map((r) => {
                const paidForRental = Number(r.collected_amount)
                return (
                  <div key={r.id} className="flex items-center gap-4 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
                    <span className="w-28 flex-shrink-0 font-semibold text-foreground">{r.bike_name}</span>
                    <span>{formatDate(r.start_date)} → {formatDate(r.end_date)} ({r.num_days} ngày)</span>
                    <span className="ml-auto font-medium text-foreground">{formatVND(r.total_amount)}</span>
                    <span className={paidForRental >= Number(r.total_amount) ? 'text-emerald-600' : 'text-red-600'}>
                      {paidForRental >= Number(r.total_amount) ? '✓ Đã thu' : `Còn ${formatVND(Number(r.total_amount) - paidForRental)}`}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5', RENTAL_STATUS_CFG[r.status]?.badge ?? '')}>
                      {RENTAL_STATUS_CFG[r.status]?.label ?? r.status}
                    </span>
                  </div>
                )
              })}
            </div>
          </TableCell>
        </TableRow>
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

  const loadBikes = () => bikesApi.listBikes().then(setBikes).catch(() => showToast('Không thể tải danh sách xe.', 'error'))
  const loadRentals = () => bikesApi.listRentals(statusFilter !== 'ALL' ? { rental_status: statusFilter } : {}).then(setRentals).catch(() => showToast('Không thể tải danh sách thuê xe.', 'error'))
  const loadReport = (month: Date) => {
    setReportLoading(true)
    bikesApi.report(toISO(firstOfMonth(month)), toISO(lastOfMonth(month)))
      .then(setReport).catch(() => showToast('Không thể tải báo cáo xe máy.', 'error')).finally(() => setReportLoading(false))
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
      const refunded = Number(rental.total_amount) - Number(updated.total_amount)
      showToast(refunded > 0 ? `Đã trả xe sớm — hoàn ${formatVND(refunded)}` : 'Đã trả xe')
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
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">🏍️ Cho thuê xe máy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quản lý đội xe và doanh thu thuê xe</p>
          </div>
          <div className="flex gap-2">
            {tab === 'fleet' && isAdmin && (
              <Button onClick={() => { setEditingBike(null); setShowBikeForm(true) }}>
                <Plus className="h-4 w-4" /> Thêm xe
              </Button>
            )}
            {tab === 'rentals' && (
              <Button onClick={() => setShowAddRental(true)}>
                <Plus className="h-4 w-4" /> Thêm thuê xe
              </Button>
            )}
          </div>
        </div>

        {/* Tab bar — "report" is an admin-only monthly reconciliation view */}
        <div className="mb-6 inline-flex w-fit gap-1 rounded-lg bg-muted p-1">
          {([...(['fleet', 'rentals'] as Tab[]), ...(isAdmin ? (['report'] as Tab[]) : [])]).map((tk) => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                tab === tk ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {TAB_LABELS[tk]}
            </button>
          ))}
        </div>

        {/* ── Fleet tab ── */}
        {tab === 'fleet' && (
          bikes.length === 0 ? (
            <div className="py-20 text-center">
              <p className="mb-4 text-5xl">🏍️</p>
              <p className="mb-4 text-sm text-muted-foreground">Chưa có xe nào. Thêm xe để bắt đầu.</p>
              {isAdmin && <Button size="lg" onClick={() => setShowBikeForm(true)}>Thêm xe đầu tiên</Button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
            <div className="flex flex-wrap gap-2">
              {[['ALL', 'Tất cả'], ['ACTIVE', 'Đang thuê'], ['RETURNED', 'Đã trả'], ['CANCELLED', 'Đã hủy']].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    statusFilter === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-foreground/30'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            {rentals.length === 0 ? (
              <div className="rounded-xl border bg-card py-16 text-center">
                <p className="mb-3 text-3xl">📋</p>
                <p className="text-sm text-muted-foreground">Không có thuê xe nào</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {['Xe', 'Khách / Phòng', 'Thời gian', 'Tổng tiền', 'Thanh toán', 'Trạng thái', 'Thao tác'].map((h) => (
                        <TableHead key={h} className="whitespace-nowrap uppercase tracking-wide">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
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
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ── Report tab ── */}
        {tab === 'report' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" aria-label="Tháng trước" onClick={() => setReportMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </Button>
              <span className="min-w-[180px] text-center text-base font-bold capitalize text-foreground">
                {reportMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
              </span>
              <Button variant="outline" size="icon" aria-label="Tháng sau" onClick={() => setReportMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Button>
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
        <Dialog open onOpenChange={(o) => { if (!o) setConfirmDelete(null) }}>
          <DialogContent className="max-w-sm" showClose={false}>
            <DialogHeader>
              <DialogTitle>Xác nhận xóa</DialogTitle>
              <DialogDescription>
                Bạn có chắc muốn {confirmDelete.type === 'bike' ? 'xóa xe' : 'hủy thuê xe'} <strong className="text-foreground">{confirmDelete.label}</strong>?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmDelete(null)}>Hủy</Button>
              <Button variant="destructive" size="lg" className="flex-1" onClick={handleConfirmedDelete}>Xác nhận</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  )
}
