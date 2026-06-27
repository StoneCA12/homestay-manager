import type { Booking } from '../../types'
import { formatDate, formatVND } from '../../utils/format'
import PrintFrame from './PrintFrame'

function nightCount(checkIn: string, checkOut: string) {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
}

const ID_TYPE_LABEL: Record<string, string> = {
  CCCD: 'CCCD', CMND: 'CMND', PASSPORT: 'Hộ chiếu',
}

const OTA_LABEL: Record<string, string> = {
  AGODA: 'Agoda', BOOKING_COM: 'Booking.com', TRAVELOKA: 'Traveloka',
  ZALO: 'Zalo', DIRECT: 'Trực tiếp',
}

interface Props {
  booking: Booking
  onClose: () => void
}

export default function ConfirmationPrint({ booking, onClose }: Props) {
  const nights = nightCount(booking.check_in_date, booking.check_out_date)
  const outstanding = Number(booking.total_price) - Number(booking.collected_amount)
  const printedAt = new Date().toLocaleString('vi-VN')

  return (
    <PrintFrame title="Xác nhận đặt phòng" onClose={onClose}>
      {/* Header */}
      <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
        <p className="text-xl font-bold uppercase tracking-widest">🏠 Homestay</p>
        <p className="text-lg font-bold mt-1 uppercase tracking-wide">Phiếu xác nhận lưu trú</p>
        <p className="text-xs text-slate-500 mt-1">Registration Card</p>
      </div>

      {/* Reference */}
      <div className="flex justify-between items-start text-xs mb-4 pb-3 border-b border-dashed border-slate-200">
        <div>
          {booking.booking_ref && (
            <p><span className="text-slate-500">Mã đặt phòng:</span> <strong className="font-mono">{booking.booking_ref}</strong></p>
          )}
          <p><span className="text-slate-500">Nguồn:</span> <strong>{OTA_LABEL[booking.ota_source] ?? booking.ota_source}</strong></p>
        </div>
        <div className="text-right">
          <p className="text-slate-500">Ngày in: {printedAt}</p>
        </div>
      </div>

      {/* Stay summary — the most important info at the top */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Nhận phòng</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">{formatDate(booking.check_in_date)}</p>
          <p className="text-[10px] text-slate-400">Từ 14:00</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-[10px] text-blue-400 uppercase tracking-wide">Số đêm</p>
          <p className="text-2xl font-bold text-blue-700 mt-0.5">{nights}</p>
          <p className="text-[10px] text-blue-400">đêm</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Trả phòng</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">{formatDate(booking.check_out_date)}</p>
          <p className="text-[10px] text-slate-400">Trước 12:00</p>
        </div>
      </div>

      {/* Room + guest side by side */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Phòng</p>
          <p className="text-2xl font-bold text-slate-800">{booking.room_number ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{booking.num_guests} khách</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Khách lưu trú</p>
          <p className="text-sm font-bold text-slate-800">{booking.guest_name}</p>
          {booking.guest_phone && <p className="text-xs text-slate-500">{booking.guest_phone}</p>}
          {booking.guest_id_type && (
            <p className="text-xs text-slate-500 font-mono">
              {ID_TYPE_LABEL[booking.guest_id_type] ?? booking.guest_id_type}: {booking.guest_id_number ?? '—'}
            </p>
          )}
        </div>
      </div>

      {/* Payment summary */}
      <div className="border border-slate-200 rounded-lg p-3 mb-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thanh toán</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Tiền phòng ({nights} đêm)</span>
            <span className="font-semibold">{formatVND(booking.total_price)}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-slate-200 pt-1">
            <span className="text-slate-500">Đã thanh toán</span>
            <span className="font-semibold text-green-600">{formatVND(booking.collected_amount)}</span>
          </div>
          <div className={`flex justify-between font-bold text-base border-t border-slate-200 pt-1 ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
            <span>{outstanding > 0 ? 'Còn lại phải trả' : '✓ Đã thanh toán đủ'}</span>
            {outstanding > 0 && <span>{formatVND(outstanding)}</span>}
          </div>
        </div>
      </div>

      {/* Notes */}
      {booking.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs">
          <p className="font-semibold text-amber-700 mb-1">Ghi chú</p>
          <p className="text-amber-800">{booking.notes}</p>
        </div>
      )}

      {/* House rules */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600 space-y-0.5">
        <p className="font-semibold text-slate-700 mb-1">Nội quy lưu trú</p>
        <p>• Trả phòng trước 12:00 — trả muộn có thể tính thêm phí</p>
        <p>• Không hút thuốc trong phòng</p>
        <p>• Không mang thức ăn có mùi nồng vào phòng</p>
        <p>• Giữ yên lặng sau 22:00</p>
        <p>• Chúng tôi không chịu trách nhiệm với tài sản để trong phòng</p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 text-center text-xs text-slate-500 mt-2">
        <div>
          <div className="h-10" />
          <p className="border-t border-slate-300 pt-1 font-medium">Lễ tân xác nhận</p>
        </div>
        <div>
          <div className="h-10" />
          <p className="border-t border-slate-300 pt-1 font-medium">Khách hàng ký tên</p>
        </div>
      </div>
    </PrintFrame>
  )
}
