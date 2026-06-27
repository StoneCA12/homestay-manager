import type { Booking } from '../../types'
import { formatDate } from '../../utils/format'
import PrintFrame from './PrintFrame'

const ID_TYPE_LABEL: Record<string, string> = {
  CCCD: 'Căn cước công dân (CCCD)',
  CMND: 'Chứng minh nhân dân (CMND)',
  PASSPORT: 'Hộ chiếu',
}

interface Props {
  booking: Booking
  onClose: () => void
}

export default function OD1Print({ booking, onClose }: Props) {
  const printedAt = new Date().toLocaleDateString('vi-VN')

  return (
    <PrintFrame title="Khai báo tạm trú (Mẫu OD-1)" onClose={onClose}>
      {/* Header */}
      <div className="text-center mb-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
        <p className="text-xs text-slate-500">Độc lập – Tự do – Hạnh phúc</p>
        <p className="text-base font-bold uppercase mt-2 tracking-wide">Tờ khai đăng ký tạm trú</p>
        <p className="text-xs text-slate-400 mt-0.5">(Dành cho khách lưu trú ngắn hạn)</p>
      </div>

      {/* Accommodation info */}
      <div className="border border-slate-300 rounded-lg p-3 mb-4 text-xs space-y-1.5">
        <Field label="Cơ sở lưu trú" value="Homestay" />
        <Field label="Địa chỉ" value="_______________________________________________" blank />
        <Field label="Số phòng" value={booking.room_number ? `Phòng ${booking.room_number}` : '___________'} />
      </div>

      {/* Guest info */}
      <div className="border border-slate-300 rounded-lg p-3 mb-4 text-xs space-y-2">
        <p className="font-bold text-slate-600 text-xs uppercase tracking-wide mb-2">Thông tin khách lưu trú</p>
        <Field n="1" label="Họ và tên (viết hoa)" value={booking.guest_name.toUpperCase()} />
        <Field n="2" label="Ngày sinh" value="____ / ____ / __________" blank />
        <Field n="3" label="Giới tính" value="□ Nam    □ Nữ    □ Khác" blank />
        <Field n="4" label="Quốc tịch" value="_______________" blank />
        <Field n="5"
          label={booking.guest_id_type ? ID_TYPE_LABEL[booking.guest_id_type] : 'Loại giấy tờ'}
          value={booking.guest_id_type ? `${booking.guest_id_type}  –  ${booking.guest_id_number ?? '_______________'}` : '_______________'}
        />
        <Field n="6" label="Ngày cấp" value="____ / ____ / __________" blank />
        <Field n="7" label="Nơi cấp" value="_______________________________________________" blank />
        <Field n="8" label="Địa chỉ thường trú" value="_______________________________________________" blank />
        <Field n="9" label="Số điện thoại" value={booking.guest_phone ?? '_______________'} />
      </div>

      {/* Stay info */}
      <div className="border border-slate-300 rounded-lg p-3 mb-4 text-xs space-y-2">
        <p className="font-bold text-slate-600 text-xs uppercase tracking-wide mb-2">Thông tin lưu trú</p>
        <Field n="10" label="Ngày đến (nhận phòng)" value={formatDate(booking.check_in_date)} />
        <Field n="11" label="Ngày đi (trả phòng)" value={formatDate(booking.check_out_date)} />
        <Field n="12" label="Số người đi cùng" value={`${Math.max(0, booking.num_guests - 1)} người`} />
        <Field n="13" label="Đến từ (tỉnh/thành phố)" value="_______________________________________________" blank />
        <Field n="14" label="Mục đích lưu trú" value="□ Du lịch    □ Công tác    □ Khác: ___________" blank />
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 mt-4 text-xs text-center text-slate-500">
        <div>
          <p className="italic mb-1">{printedAt}</p>
          <div className="h-12" />
          <p className="border-t border-slate-300 pt-1 font-medium">Khách lưu trú ký và ghi rõ họ tên</p>
        </div>
        <div>
          <p className="italic mb-1">&nbsp;</p>
          <div className="h-12" />
          <p className="border-t border-slate-300 pt-1 font-medium">Lễ tân xác nhận</p>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center mt-4 border-t pt-3">
        Lưu tại cơ sở lưu trú · In từ hệ thống quản lý Homestay · {printedAt}
      </p>
    </PrintFrame>
  )
}

function Field({ n, label, value, blank }: {
  n?: string; label: string; value: string; blank?: boolean
}) {
  return (
    <div className="flex gap-2">
      {n && <span className="text-slate-400 w-4 flex-shrink-0">{n}.</span>}
      <span className="text-slate-500 flex-shrink-0">{label}:</span>
      <span className={blank ? 'text-slate-400' : 'font-medium text-slate-800'}>{value}</span>
    </div>
  )
}
