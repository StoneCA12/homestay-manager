import { useTranslation } from 'react-i18next'
import type { Room } from '../../types'
import { formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { bg: string; border: string; badge: string }> = {
  AVAILABLE:      { bg: 'bg-white',       border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-500'    },
  OCCUPIED:       { bg: 'bg-green-50',    border: 'border-green-300',  badge: 'bg-green-500 text-white'      },
  ARRIVAL_TODAY:  { bg: 'bg-yellow-50',   border: 'border-yellow-300', badge: 'bg-yellow-400 text-white'     },
  CHECKOUT_TODAY: { bg: 'bg-blue-50',     border: 'border-blue-300',   badge: 'bg-blue-500 text-white'       },
  DIRTY:          { bg: 'bg-red-50',      border: 'border-red-300',    badge: 'bg-red-500 text-white'        },
  CLEANING:       { bg: 'bg-orange-50',   border: 'border-orange-300', badge: 'bg-orange-400 text-white'     },
  OUT_OF_ORDER:   { bg: 'bg-gray-100',    border: 'border-gray-400',   badge: 'bg-gray-500 text-white'       },
  OVERBOOKING:    { bg: 'bg-purple-50',   border: 'border-purple-300', badge: 'bg-purple-600 text-white'     },
}

export default function RoomCard({ room, onClick }: { room: Room; onClick?: () => void }) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[room.display_status] ?? STATUS_CONFIG.AVAILABLE
  const clickable = !!onClick && !!room.active_booking_id

  return (
    <div
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!() } } : undefined}
      className={cn(
        'flex flex-col gap-2 rounded-xl border-2 p-4 shadow-sm transition-shadow',
        cfg.bg, cfg.border,
        clickable ? 'cursor-pointer hover:shadow-md hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : 'hover:shadow-md',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <span className="text-2xl font-bold text-foreground">{room.room_number}</span>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cfg.badge}`}>
          {t(`displayStatus.${room.display_status}` as any)}
        </span>
      </div>

      {/* Room type + floor */}
      <p className="text-xs text-muted-foreground">
        {t(`roomType.${room.room_type}` as any)} · Tầng {room.floor} · {room.capacity} khách
      </p>

      {/* Guest info when occupied */}
      {room.guest_name && (
        <div className="mt-1 border-t border-dashed border-border pt-2">
          <p className="truncate text-sm font-medium text-foreground">{room.guest_name}</p>
          {room.check_out_date && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Trả phòng:{' '}
              {new Date(room.check_out_date).toLocaleDateString('vi-VN', {
                day: 'numeric', month: 'short',
              })}
            </p>
          )}
          {room.active_bike_names.length > 0 && (
            <p className="mt-1 text-xs font-medium text-purple-600">
              🏍️ {room.active_bike_names.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Price */}
      <p className="mt-auto text-xs text-muted-foreground">{formatVND(room.base_price)}/đêm</p>
    </div>
  )
}
