import { useTranslation } from 'react-i18next'
import type { Room, RoomStatus } from '../../types'

const STATUS_CONFIG: Record<RoomStatus, { bg: string; border: string; badge: string }> = {
  AVAILABLE:    { bg: 'bg-white',     border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600'  },
  DIRTY:        { bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-500 text-white'      },
  CLEANING:     { bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-400 text-white'   },
  OUT_OF_ORDER: { bg: 'bg-gray-100',  border: 'border-gray-400',   badge: 'bg-gray-500 text-white'     },
}

// Maps current status → what status clicking the button transitions to
const ACTIONS: Record<RoomStatus, { next: RoomStatus; color: string }[]> = {
  AVAILABLE:    [{ next: 'DIRTY',     color: 'bg-red-100 text-red-700 hover:bg-red-200'         }],
  DIRTY:        [{ next: 'CLEANING',  color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' }],
  CLEANING:     [{ next: 'AVAILABLE', color: 'bg-green-100 text-green-700 hover:bg-green-200'   }],
  OUT_OF_ORDER: [{ next: 'AVAILABLE', color: 'bg-gray-100 text-gray-700 hover:bg-gray-200'      }],
}

interface Props {
  room: Room
  updating: boolean
  onStatusChange: (room: Room, next: RoomStatus) => void
}

export default function HousekeepingRoomCard({ room, updating, onStatusChange }: Props) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[room.housekeeping_status]
  const actions = ACTIONS[room.housekeeping_status]

  return (
    <div className={`rounded-xl border-2 ${cfg.bg} ${cfg.border} p-4 flex flex-col gap-3 shadow-sm`}>
      <div className="flex items-start justify-between">
        <span className="text-2xl font-bold text-slate-800">{room.room_number}</span>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.badge}`}>
          {t(`roomStatus.${room.housekeeping_status}` as any)}
        </span>
      </div>
      <p className="text-xs text-slate-500">{room.room_type} · Floor {room.floor}</p>
      <div className="flex flex-col gap-1.5 mt-auto">
        {actions.map((a) => (
          <button
            key={a.next}
            disabled={updating}
            onClick={() => onStatusChange(room, a.next)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${a.color}`}
          >
            {updating ? t('housekeeping.updating') : `${t('housekeeping.update')} → ${t(`roomStatus.${a.next}` as any)}`}
          </button>
        ))}
      </div>
    </div>
  )
}

export { STATUS_CONFIG }
