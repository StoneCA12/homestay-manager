import { AlertTriangle } from 'lucide-react'
import type { ConflictDetail, RoomSuggestion, BikeSuggestion } from '../../lib/conflictParser'
import { formatVND } from '../../utils/format'

interface Props {
  conflict: ConflictDetail
  onSelectRoom?: (roomId: number) => void
  onSelectBike?: (bikeId: number) => void
}

export default function ConflictAlert({ conflict, onSelectRoom, onSelectBike }: Props) {
  const isRoom = conflict.type === 'ROOM_CONFLICT'
  const c = conflict.conflict

  const blockedByLine = isRoom
    ? `Khách ${(c as any).guest_name} · ${(c as any).check_in_date} → ${(c as any).check_out_date}`
    : (() => {
        const bc = c as any
        const room = bc.room_number ? ` · Phòng ${bc.room_number}` : ''
        return `Khách ${bc.guest_name}${room} · ${bc.start_date} → ${bc.end_date}`
      })()

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-700">{conflict.message}</p>
          <p className="mt-0.5 text-xs text-red-600">{blockedByLine}</p>
        </div>
      </div>

      {/* Room suggestions */}
      {isRoom && conflict.suggestions.length > 0 && onSelectRoom && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-red-700">Phòng trống cùng kỳ:</p>
          <div className="flex flex-wrap gap-1.5">
            {(conflict.suggestions as RoomSuggestion[]).map((s) => (
              <button
                key={s.room_id}
                type="button"
                onClick={() => onSelectRoom(s.room_id)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <span className="font-bold">P.{s.room_number}</span>
                <span className="text-red-500">{formatVND(s.base_price)}/đêm</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {isRoom && conflict.suggestions.length === 0 && (
        <p className="text-xs text-red-600">Không có phòng trống trong khoảng thời gian này.</p>
      )}

      {/* Bike suggestions */}
      {!isRoom && conflict.suggestions.length > 0 && onSelectBike && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-red-700">Xe trống cùng kỳ:</p>
          <div className="flex flex-wrap gap-1.5">
            {(conflict.suggestions as BikeSuggestion[]).map((s) => (
              <button
                key={s.bike_id}
                type="button"
                onClick={() => onSelectBike(s.bike_id)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <span className="font-bold">{s.bike_name}</span>
                {s.plate_number && <span className="font-mono text-red-500">{s.plate_number}</span>}
                <span className="text-red-500">{formatVND(s.daily_rate)}/ngày</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!isRoom && conflict.suggestions.length === 0 && (
        <p className="text-xs text-red-600">Không có xe trống trong khoảng thời gian này.</p>
      )}
    </div>
  )
}
