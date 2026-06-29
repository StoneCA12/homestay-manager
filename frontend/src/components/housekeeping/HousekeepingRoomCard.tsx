import { Bike, Eye, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Room, RoomStatus } from '../../types'
import { formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'

// ── Status config keyed on housekeeping_status (for the summary cards export) ─
export const STATUS_CONFIG: Record<RoomStatus, { bg: string; border: string; badge: string }> = {
  AVAILABLE:    { bg: 'bg-card',       border: 'border-border',     badge: 'bg-muted text-muted-foreground' },
  DIRTY:        { bg: 'bg-red-50',     border: 'border-red-300',    badge: 'bg-red-500 text-white'          },
  CLEANING:     { bg: 'bg-orange-50',  border: 'border-orange-300', badge: 'bg-orange-500 text-white'       },
  OUT_OF_ORDER: { bg: 'bg-slate-100',  border: 'border-slate-400',  badge: 'bg-slate-500 text-white'        },
}

// ── Display-status config (card border + status badge) ─────────────────────────
const DISPLAY_CONFIG: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  AVAILABLE:      { bg: 'bg-card',        border: 'border-border',      badge: 'bg-muted text-muted-foreground',         label: 'Trống'        },
  OCCUPIED:       { bg: 'bg-emerald-50',  border: 'border-emerald-300', badge: 'bg-emerald-500 text-white',              label: 'Đang ở'       },
  ARRIVAL_TODAY:  { bg: 'bg-amber-50',    border: 'border-amber-300',   badge: 'bg-amber-500 text-white',                label: 'Đến hôm nay'  },
  CHECKOUT_TODAY: { bg: 'bg-blue-50',     border: 'border-blue-300',    badge: 'bg-blue-500 text-white',                 label: 'Trả hôm nay'  },
  DIRTY:          { bg: 'bg-red-50',      border: 'border-red-300',     badge: 'bg-red-500 text-white',                  label: 'Cần dọn'      },
  CLEANING:       { bg: 'bg-orange-50',   border: 'border-orange-300',  badge: 'bg-orange-500 text-white',               label: 'Đang dọn'     },
  OUT_OF_ORDER:   { bg: 'bg-slate-100',   border: 'border-slate-400',   badge: 'bg-slate-500 text-white',                label: 'Bảo trì'      },
  OVERBOOKING:    { bg: 'bg-purple-50',   border: 'border-purple-300',  badge: 'bg-purple-600 text-white',               label: 'Trùng phòng'  },
}

// ── Housekeeping transition (primary action button) ────────────────────────────
const HK_NEXT: Record<RoomStatus, { next: RoomStatus; label: string; cls: string }> = {
  DIRTY:        { next: 'CLEANING',  label: 'Bắt đầu dọn', cls: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  CLEANING:     { next: 'AVAILABLE', label: 'Dọn xong',    cls: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  AVAILABLE:    { next: 'DIRTY',     label: 'Đánh dấu bẩn', cls: 'bg-red-100 text-red-700 hover:bg-red-200' },
  OUT_OF_ORDER: { next: 'AVAILABLE', label: 'Khôi phục',   cls: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}

interface Props {
  room: Room
  updating: boolean
  onStatusChange: (room: Room, next: RoomStatus) => void
  onViewBooking?: (bookingId: number) => void
  onAssignGuest?: (room: Room) => void
}

export default function HousekeepingRoomCard({
  room,
  updating,
  onStatusChange,
  onViewBooking,
  onAssignGuest,
}: Props) {
  const { t } = useTranslation()
  const cfg = DISPLAY_CONFIG[room.display_status] ?? DISPLAY_CONFIG.AVAILABLE
  const hkNext = HK_NEXT[room.housekeeping_status]

  const hasGuest = Boolean(room.guest_name)
  const outstanding = room.outstanding_balance ? Number(room.outstanding_balance) : 0
  const canAssign = !room.active_booking_id && room.housekeeping_status === 'AVAILABLE'

  return (
    <div className={cn('flex flex-col gap-2.5 rounded-xl border-2 p-3 shadow-sm transition-shadow hover:shadow-md', cfg.bg, cfg.border)}>

      {/* ── Header: room number + status badge ── */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-xl font-bold leading-none text-foreground">
          P.{room.room_number}
        </span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none', cfg.badge)}>
          {cfg.label}
        </span>
      </div>

      {/* ── Room meta ── */}
      <p className="text-[11px] text-muted-foreground">
        {t(`roomType.${room.room_type}` as any)} · Tầng {room.floor} · {room.capacity} khách
      </p>

      {/* ── Guest info (when occupied) ── */}
      {hasGuest && (
        <div className="border-t border-dashed border-border pt-2 space-y-0.5">
          <p className="truncate text-sm font-semibold text-foreground">{room.guest_name}</p>

          {room.check_out_date && (
            <p className="text-xs text-muted-foreground">
              Trả phòng: {fmtDate(room.check_out_date)}
            </p>
          )}

          {outstanding > 0 && (
            <p className="text-xs font-semibold text-red-600">
              Còn nợ: {formatVND(room.outstanding_balance!)}
            </p>
          )}

          {room.active_bike_names.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-purple-600">
              <Bike className="h-3 w-3 shrink-0" />
              {room.active_bike_names.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="mt-auto flex flex-col gap-1.5 pt-1">
        {/* Housekeeping cycle */}
        <button
          disabled={updating}
          onClick={() => onStatusChange(room, hkNext.next)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
            hkNext.cls,
          )}
        >
          {updating ? '...' : hkNext.label}
        </button>

        {/* View booking */}
        {room.active_booking_id != null && onViewBooking && (
          <button
            onClick={() => onViewBooking(room.active_booking_id!)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Eye className="h-3 w-3" />
            Xem đặt phòng
          </button>
        )}

        {/* Assign guest (only for AVAILABLE rooms with no booking) */}
        {canAssign && onAssignGuest && (
          <button
            onClick={() => onAssignGuest(room)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            Đặt phòng mới
          </button>
        )}
      </div>
    </div>
  )
}
