import { useTranslation } from 'react-i18next'
import type { Room } from '../../types'

const STATUS_CONFIG: Record<
  string,
  { bg: string; border: string; badge: string }
> = {
  AVAILABLE:     { bg: 'bg-white',        border: 'border-gray-200',  badge: 'bg-gray-100 text-gray-600'    },
  OCCUPIED:      { bg: 'bg-green-50',     border: 'border-green-300', badge: 'bg-green-500 text-white'      },
  ARRIVAL_TODAY: { bg: 'bg-yellow-50',    border: 'border-yellow-300',badge: 'bg-yellow-400 text-white'     },
  CHECKOUT_TODAY:{ bg: 'bg-blue-50',      border: 'border-blue-300',  badge: 'bg-blue-500 text-white'       },
  DIRTY:         { bg: 'bg-red-50',       border: 'border-red-300',   badge: 'bg-red-500 text-white'        },
  CLEANING:      { bg: 'bg-orange-50',    border: 'border-orange-300',badge: 'bg-orange-400 text-white'     },
  OUT_OF_ORDER:  { bg: 'bg-gray-100',     border: 'border-gray-400',  badge: 'bg-gray-500 text-white'       },
  OVERBOOKING:   { bg: 'bg-purple-50',    border: 'border-purple-300',badge: 'bg-purple-600 text-white'     },
}

const ROOM_TYPE_LABEL: Record<string, string> = {
  SINGLE: 'Single', DOUBLE: 'Double', TWIN: 'Twin', TRIPLE: 'Triple', SUITE: 'Suite',
}

function formatVND(amount: string) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount))
}

export default function RoomCard({ room }: { room: Room }) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[room.display_status] ?? STATUS_CONFIG.AVAILABLE

  return (
    <div className={`rounded-xl border-2 ${cfg.bg} ${cfg.border} p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <span className="text-2xl font-bold text-slate-800">{room.room_number}</span>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.badge}`}>
          {t(`displayStatus.${room.display_status}` as any)}
        </span>
      </div>

      {/* Room type + floor */}
      <p className="text-xs text-slate-500">
        {ROOM_TYPE_LABEL[room.room_type]} · Floor {room.floor} · {room.capacity}{' '}
        {room.capacity === 1 ? 'guest' : 'guests'}
      </p>

      {/* Guest info */}
      {room.guest_name && (
        <div className="border-t border-dashed border-current/20 pt-2 mt-1">
          <p className="text-sm font-medium text-slate-700 truncate">{room.guest_name}</p>
          {room.check_out_date && (
            <p className="text-xs text-slate-500">
              Checkout:{' '}
              {new Date(room.check_out_date).toLocaleDateString('vi-VN', {
                day: 'numeric', month: 'short',
              })}
            </p>
          )}
        </div>
      )}

      {/* Price */}
      <p className="text-xs text-slate-400 mt-auto">{formatVND(room.base_price)}/night</p>
    </div>
  )
}
