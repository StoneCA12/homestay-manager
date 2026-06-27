import type { BikeRental, Booking, Payment } from '../../types'
import { formatDate, formatVND } from '../../utils/format'
import PrintFrame from './PrintFrame'

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  OTA_COLLECTED: 'OTA thu',
}

function nightCount(checkIn: string, checkOut: string) {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
}

interface Props {
  booking: Booking
  payments: Payment[]
  bikeRentals: BikeRental[]
  onClose: () => void
}

export default function ReceiptPrint({ booking, payments, bikeRentals, onClose }: Props) {
  const nights = nightCount(booking.check_in_date, booking.check_out_date)
  const activeBikes = bikeRentals.filter((r) => r.status !== 'CANCELLED')
  const bikeTotals = activeBikes.reduce((s, r) => s + Number(r.total_amount), 0)
  const grandTotal = Number(booking.total_price) + bikeTotals
  const grandCollected = Number(booking.collected_amount) + activeBikes.reduce((s, r) => s + Number(r.collected_amount), 0)
  const outstanding = grandTotal - grandCollected
  const printedAt = new Date().toLocaleString('vi-VN')

  return (
    <PrintFrame title="Biên nhận thanh toán" onClose={onClose}>
      {/* Header */}
      <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
        <p className="text-lg font-bold uppercase tracking-wide">🏠 Homestay</p>
        <p className="text-base font-bold mt-1 uppercase">Biên nhận thanh toán</p>
        {booking.booking_ref && (
          <p className="text-xs text-slate-500 mt-1">Mã đặt phòng: {booking.booking_ref}</p>
        )}
      </div>

      {/* Guest info */}
      <Section label="Thông tin khách">
        <Row label="Họ tên" value={booking.guest_name} />
        <Row label="Điện thoại" value={booking.guest_phone ?? '—'} />
        {booking.guest_id_type && (
          <Row
            label={booking.guest_id_type === 'PASSPORT' ? 'Hộ chiếu' : booking.guest_id_type}
            value={booking.guest_id_number ?? '—'}
          />
        )}
      </Section>

      {/* Stay info */}
      <Section label="Thông tin lưu trú">
        <Row label="Phòng" value={booking.room_number ? `Phòng ${booking.room_number}` : '—'} />
        <Row label="Nhận phòng" value={formatDate(booking.check_in_date)} />
        <Row label="Trả phòng" value={formatDate(booking.check_out_date)} />
        <Row label="Số đêm" value={`${nights} đêm`} />
        <Row label="Số khách" value={`${booking.num_guests} khách`} />
      </Section>

      {/* Charges */}
      <Section label="Chi tiết thanh toán">
        <Row
          label={`Tiền phòng (${nights} đêm)`}
          value={formatVND(booking.total_price)}
          bold
        />
        {activeBikes.map((r) => (
          <Row
            key={r.id}
            label={`🏍️ ${r.bike_name} (${r.num_days} ngày)`}
            value={formatVND(r.total_amount)}
          />
        ))}
        {activeBikes.length > 0 && (
          <div className="border-t border-dashed border-slate-200 mt-1 pt-1">
            <Row label="Tổng cộng" value={formatVND(grandTotal)} bold />
          </div>
        )}
        <div className="border-t border-slate-200 mt-2 pt-2 space-y-1">
          <Row label="Đã thanh toán" value={formatVND(grandCollected)} />
          <Row
            label="Còn lại"
            value={formatVND(Math.max(0, outstanding))}
            highlight={outstanding > 0}
          />
        </div>
      </Section>

      {/* Payment history */}
      {payments.length > 0 && (
        <Section label="Lịch sử thanh toán">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between py-0.5">
              <span className="text-slate-500">
                {new Date(p.paid_at).toLocaleDateString('vi-VN')} · {METHOD_LABEL[p.method] ?? p.method}
              </span>
              <span className="font-medium">{formatVND(p.amount)}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Notes */}
      {booking.notes && (
        <Section label="Ghi chú">
          <p className="text-slate-600">{booking.notes}</p>
        </Section>
      )}

      {/* Signatures */}
      <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
        <div>
          <div className="h-10" />
          <p className="border-t border-slate-300 pt-1">Lễ tân</p>
        </div>
        <div>
          <div className="h-10" />
          <p className="border-t border-slate-300 pt-1">Khách hàng</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center mt-4">In lúc {printedAt}</p>
    </PrintFrame>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({ label, value, bold, highlight }: {
  label: string; value: string | number; bold?: boolean; highlight?: boolean
}) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${highlight ? 'text-red-600' : ''}`}>
        {value}
      </span>
    </div>
  )
}
