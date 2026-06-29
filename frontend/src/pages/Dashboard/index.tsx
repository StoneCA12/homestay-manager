import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, BedDouble, Bike, Check,
  Clock, LogIn, LogOut, RefreshCw, Wrench,
} from 'lucide-react'
import Layout from '../../components/layout/Layout'
import RoomCard from '../../components/rooms/RoomCard'
import { activityApi, bookingsApi, revenueApi, roomsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { ActivityItem, Booking, BookingSummaryRow, BikeReturnRow, DailyReport, Room } from '../../types'
import { formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────

interface DashboardData {
  report: DailyReport | null
  rooms: Room[]
  lateCheckins: Booking[]
  noRoom: Booking[]
  activity: ActivityItem[]
}

const INITIAL: DashboardData = { report: null, rooms: [], lateCheckins: [], noRoom: [], activity: [] }

// ── Accent palette ────────────────────────────────────────────────

const ACCENT = {
  yellow: { panel: 'border-amber-200 bg-amber-50/40',      badge: 'bg-amber-100 text-amber-700',       header: 'text-amber-700' },
  blue:   { panel: 'border-blue-200 bg-blue-50/40',        badge: 'bg-blue-100 text-blue-700',         header: 'text-blue-700'  },
  green:  { panel: 'border-emerald-200 bg-emerald-50/40',  badge: 'bg-emerald-100 text-emerald-700',   header: 'text-emerald-700' },
  purple: { panel: 'border-purple-200 bg-purple-50/40',    badge: 'bg-purple-100 text-purple-700',     header: 'text-purple-700' },
  red:    { panel: 'border-red-200 bg-red-50/40',          badge: 'bg-red-100 text-red-700',           header: 'text-red-700'   },
  amber:  { panel: 'border-amber-300 bg-amber-50/60',      badge: 'bg-amber-200 text-amber-800',       header: 'text-amber-800' },
  slate:  { panel: 'border-border bg-muted/30',            badge: 'bg-muted text-muted-foreground',    header: 'text-muted-foreground' },
} as const
type Accent = keyof typeof ACCENT

// ── WidgetCard ────────────────────────────────────────────────────

function WidgetCard({
  title, count, icon: Icon, accent, loading, emptyMessage, onSeeAll, children,
}: {
  title: string
  count: number
  icon: React.ElementType
  accent: Accent
  loading: boolean
  emptyMessage: string
  onSeeAll?: () => void
  children?: React.ReactNode
}) {
  const c = ACCENT[accent]
  return (
    <div className={cn('flex flex-col rounded-xl border ring-1 ring-foreground/5', c.panel)}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4 shrink-0', c.header)} />
          <p className={cn('text-sm font-semibold', c.header)}>{title}</p>
          {count > 0 && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', c.badge)}>{count}</span>
          )}
        </div>
        {onSeeAll && count > 0 && (
          <button
            onClick={onSeeAll}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
          >
            Xem <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ maxHeight: '220px' }}>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-background/60" />
            ))}
          </div>
        ) : count === 0 ? (
          <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-border/50">{children}</div>
        )}
      </div>
    </div>
  )
}

// ── Row components (module-level to preserve identity) ────────────

function SummaryRow({ row, onClick, showCheckout }: { row: BookingSummaryRow; onClick: () => void; showCheckout?: boolean }) {
  const owed = Number(row.total_price) - Number(row.collected_amount) + Number(row.bike_outstanding)
  return (
    <button onClick={onClick} className="group w-full rounded-lg px-1 py-2 text-left transition-colors hover:bg-background/60">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{row.room_number ? `P.${row.room_number}` : '—'}</span>
            <span className="truncate text-sm text-muted-foreground">{row.guest_name}</span>
          </div>
          {showCheckout && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Trả: {new Date(row.check_out_date + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
        {owed > 0
          ? <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Còn {formatVND(owed)}</span>
          : <Check className="h-4 w-4 shrink-0 text-emerald-500" />
        }
      </div>
    </button>
  )
}

function BookingRow({ booking, onClick, showCheckIn }: { booking: Booking; onClick: () => void; showCheckIn?: boolean }) {
  const owed = Number(booking.total_price) - Number(booking.collected_amount)
  return (
    <button onClick={onClick} className="group w-full rounded-lg px-1 py-2 text-left transition-colors hover:bg-background/60">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{booking.room_number ? `P.${booking.room_number}` : '—'}</span>
            <span className="truncate text-sm text-muted-foreground">{booking.guest_name}</span>
          </div>
          {showCheckIn && (
            <p className="mt-0.5 text-xs text-red-500">
              Dự kiến: {new Date(booking.check_in_date + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
        {owed > 0 && (
          <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Còn {formatVND(owed)}</span>
        )}
      </div>
    </button>
  )
}

function BikeRow({ row, onClick }: { row: BikeReturnRow; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg px-1 py-2 text-left transition-colors hover:bg-background/60">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-purple-700">{row.bike_name}</span>
            {row.plate_number && <span className="font-mono text-xs text-muted-foreground">{row.plate_number}</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{row.room_number ? `P.${row.room_number}` : '—'} · {row.guest_name}</p>
        </div>
        {Number(row.outstanding) > 0
          ? <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">Còn {formatVND(row.outstanding)}</span>
          : <Check className="h-4 w-4 shrink-0 text-emerald-500" />
        }
      </div>
    </button>
  )
}

function RoomRow({ room, onClick }: { room: Room; onClick: () => void }) {
  const statusLabel =
    room.housekeeping_status === 'DIRTY'        ? 'Chưa dọn'  :
    room.housekeeping_status === 'CLEANING'     ? 'Đang dọn'  :
    room.housekeeping_status === 'OUT_OF_ORDER' ? 'Tạm ngừng' : ''
  const statusColor =
    room.housekeeping_status === 'DIRTY'        ? 'text-red-600 bg-red-50 border-red-200'       :
    room.housekeeping_status === 'CLEANING'     ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-gray-500 bg-gray-100 border-gray-200'
  const urgentArrival = room.display_status === 'ARRIVAL_TODAY'

  return (
    <button onClick={onClick} className="w-full rounded-lg px-1 py-2 text-left transition-colors hover:bg-background/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">P.{room.room_number}</span>
          {urgentArrival && <span className="text-[10px] font-semibold text-amber-600">KHÁCH SẮP TỚI</span>}
        </div>
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', statusColor)}>{statusLabel}</span>
      </div>
    </button>
  )
}

const EVENT_COLORS: Record<string, string> = {
  BOOKING_CREATED: 'bg-blue-100 text-blue-700',
  CHECKED_IN:      'bg-emerald-100 text-emerald-700',
  CHECKED_OUT:     'bg-blue-100 text-blue-700',
  CANCELLED:       'bg-red-100 text-red-700',
  NO_SHOW:         'bg-orange-100 text-orange-700',
  PAYMENT:         'bg-violet-100 text-violet-700',
  ROOM_STATUS:     'bg-amber-100 text-amber-700',
  BIKE_ASSIGNED:   'bg-purple-100 text-purple-700',
  BIKE_RETURNED:   'bg-purple-100 text-purple-700',
}
const EVENT_LABELS: Record<string, string> = {
  BOOKING_CREATED: 'Tạo mới',  CHECKED_IN: 'Nhận phòng', CHECKED_OUT: 'Trả phòng',
  CANCELLED: 'Hủy',            NO_SHOW: 'Không đến',     PAYMENT: 'Thanh toán',
  ROOM_STATUS: 'Dọn phòng',    BIKE_ASSIGNED: 'Thuê xe', BIKE_RETURNED: 'Trả xe',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)    return 'vừa xong'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}

function ActivityRow({ log, onClick }: { log: ActivityItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40">
      <span className={cn('mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold', EVENT_COLORS[log.event_type] ?? 'bg-muted text-muted-foreground')}>
        {EVENT_LABELS[log.event_type] ?? log.event_type}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-foreground">{log.description}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {log.actor_name ?? 'Hệ thống'} · {timeAgo(log.created_at)}
        </p>
      </div>
    </button>
  )
}

function Chip({ label, value, color, onClick }: { label: string; value: string | number; color: string; onClick?: () => void }) {
  const COLORS: Record<string, string> = {
    green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    yellow: 'bg-amber-50   border-amber-200   text-amber-700',
    blue:   'bg-blue-50    border-blue-200    text-blue-700',
    red:    'bg-red-50     border-red-200     text-red-700',
    purple: 'bg-purple-50  border-purple-200  text-purple-700',
    slate:  'bg-muted/40   border-border      text-muted-foreground',
  }
  const cls = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
    COLORS[color] ?? COLORS.slate,
    onClick && 'cursor-pointer transition-opacity hover:opacity-80'
  )
  return onClick
    ? <button onClick={onClick} className={cls}><span className="text-sm font-bold">{value}</span>{label}</button>
    : <span className={cls}><span className="text-sm font-bold">{value}</span>{label}</span>
}

const LEGEND = [
  { label: 'Đang ở',          dot: 'bg-emerald-500' },
  { label: 'Nhận hôm nay',    dot: 'bg-amber-400'   },
  { label: 'Trả hôm nay',     dot: 'bg-blue-500'    },
  { label: 'Cần dọn',         dot: 'bg-red-500'     },
  { label: 'Đang dọn',        dot: 'bg-orange-400'  },
  { label: 'Ngừng hoạt động', dot: 'bg-gray-400'    },
  { label: 'Trống',           dot: 'bg-gray-300'    },
] as const

// ── Main page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardData>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goBooking   = useCallback((id: number) => navigate('/bookings', { state: { openBookingId: id } }), [navigate])
  const goTab       = useCallback((tab: string) => navigate('/bookings', { state: { fabTab: tab } }), [navigate])
  const goRooms     = useCallback(() => navigate('/phong'), [navigate])
  const goBikes     = useCallback(() => navigate('/xe-may'), [navigate])

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)

    const todayIso     = new Date().toISOString().slice(0, 10)
    const yesterdayIso = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

    const [reportRes, roomsRes, lateRes, noRoomRes, activityRes] = await Promise.allSettled([
      revenueApi.dailyReport(),
      roomsApi.list(),
      // late check-ins: CONFIRMED, check_in <= yesterday AND check_out >= today
      bookingsApi.list({ booking_status: 'CONFIRMED', start_date: todayIso, end_date: yesterdayIso }),
      // no-room: CONFIRMED, check_out >= today (filter room_id === null client-side)
      bookingsApi.list({ booking_status: 'CONFIRMED', start_date: todayIso, limit: 100 }),
      activityApi.list({ limit: 20 }),
    ])

    setData({
      report:       reportRes.status  === 'fulfilled' ? reportRes.value  : null,
      rooms:        roomsRes.status   === 'fulfilled' ? roomsRes.value   : [],
      lateCheckins: lateRes.status    === 'fulfilled' ? lateRes.value    : [],
      noRoom:       noRoomRes.status  === 'fulfilled' ? noRoomRes.value  : [],
      activity:     activityRes.status === 'fulfilled' ? activityRes.value : [],
    })
    setLastRefreshed(new Date())
    setLoading(false)
    if (isManual) setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(() => fetchAll(), 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchAll])

  const outstandingItems = useMemo((): BookingSummaryRow[] => {
    if (!data.report) return []
    return [...data.report.arrivals, ...data.report.in_house, ...data.report.departures].filter(
      (b) => (Number(b.total_price) - Number(b.collected_amount) + Number(b.bike_outstanding)) > 0
    )
  }, [data.report])

  const noRoomItems = useMemo(() => data.noRoom.filter((b) => !b.room_id), [data.noRoom])

  const hkQueue = useMemo(
    () => data.rooms.filter((r) => r.housekeeping_status !== 'AVAILABLE'),
    [data.rooms]
  )

  const occupancyPct = data.rooms.length > 0
    ? Math.round(((data.report?.in_house.length ?? 0) / data.rooms.length) * 100)
    : 0

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const lastRefreshedStr = lastRefreshed
    ? lastRefreshed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold capitalize tracking-tight text-foreground">{today}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Chào {user?.full_name?.split(' ').pop()} — đây là tình hình hôm nay
            </p>
          </div>
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {lastRefreshedStr ? `Cập nhật lúc ${lastRefreshedStr}` : 'Làm mới'}
          </button>
        </div>

        {/* ── Stat chips ── */}
        {data.report && (
          <div className="flex flex-wrap gap-2">
            <Chip label="Phòng" value={`${data.report.in_house.length}/${data.rooms.length}`} color="green" />
            <Chip label="Nhận hôm nay"  value={data.report.arrivals.length}    color="yellow" />
            <Chip label="Trả hôm nay"   value={data.report.departures.length}  color="blue" />
            {hkQueue.length > 0 && (
              <Chip label="Cần dọn" value={hkQueue.length} color="red" onClick={goRooms} />
            )}
            {data.report.active_bike_count > 0 && (
              <Chip label="Xe đang thuê" value={data.report.active_bike_count} color="purple" onClick={goBikes} />
            )}
            {Number(data.report.revenue.outstanding) > 0 && (
              <Chip label="Còn nợ" value={formatVND(data.report.revenue.outstanding)} color="red" onClick={() => goTab('all')} />
            )}
          </div>
        )}

        {/* ── Widget grid ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

          {/* Row 1: Today's operations */}
          <WidgetCard
            title="Nhận phòng hôm nay"
            count={data.report?.arrivals.length ?? 0}
            icon={LogIn}
            accent="yellow"
            loading={loading}
            emptyMessage="Không có khách nhận phòng hôm nay"
            onSeeAll={() => goTab('today')}
          >
            {data.report?.arrivals.map((b) => (
              <SummaryRow key={b.id} row={b} onClick={() => goBooking(b.id)} />
            ))}
          </WidgetCard>

          <WidgetCard
            title="Trả phòng hôm nay"
            count={data.report?.departures.length ?? 0}
            icon={LogOut}
            accent="blue"
            loading={loading}
            emptyMessage="Không có khách trả phòng hôm nay"
            onSeeAll={() => goTab('today')}
          >
            {data.report?.departures.map((b) => (
              <SummaryRow key={b.id} row={b} onClick={() => goBooking(b.id)} />
            ))}
          </WidgetCard>

          <WidgetCard
            title="Đang lưu trú"
            count={data.report?.in_house.length ?? 0}
            icon={BedDouble}
            accent="green"
            loading={loading}
            emptyMessage="Hiện không có khách lưu trú"
            onSeeAll={() => goTab('all')}
          >
            {data.report?.in_house.map((b) => (
              <SummaryRow key={b.id} row={b} onClick={() => goBooking(b.id)} showCheckout />
            ))}
          </WidgetCard>

          {/* Row 2: Urgent attention */}
          <WidgetCard
            title="Nhận phòng trễ"
            count={data.lateCheckins.length}
            icon={Clock}
            accent={data.lateCheckins.length > 0 ? 'red' : 'slate'}
            loading={loading}
            emptyMessage="Không có khách trễ nhận phòng ✓"
            onSeeAll={() => goTab('today')}
          >
            {data.lateCheckins.map((b) => (
              <BookingRow key={b.id} booking={b} onClick={() => goBooking(b.id)} showCheckIn />
            ))}
          </WidgetCard>

          <WidgetCard
            title="Còn công nợ"
            count={outstandingItems.length}
            icon={AlertTriangle}
            accent={outstandingItems.length > 0 ? 'amber' : 'slate'}
            loading={loading}
            emptyMessage="Tất cả đã thanh toán đủ ✓"
            onSeeAll={() => goTab('all')}
          >
            {outstandingItems.map((b) => (
              <SummaryRow key={b.id} row={b} onClick={() => goBooking(b.id)} />
            ))}
          </WidgetCard>

          <WidgetCard
            title="Chưa gán phòng"
            count={noRoomItems.length}
            icon={BedDouble}
            accent={noRoomItems.length > 0 ? 'amber' : 'slate'}
            loading={loading}
            emptyMessage="Tất cả đặt phòng đã có phòng ✓"
            onSeeAll={() => goTab('all')}
          >
            {noRoomItems.map((b) => (
              <BookingRow key={b.id} booking={b} onClick={() => goBooking(b.id)} showCheckIn />
            ))}
          </WidgetCard>

          {/* Row 3: Maintenance + occupancy */}
          <WidgetCard
            title="Hàng chờ dọn phòng"
            count={hkQueue.length}
            icon={Wrench}
            accent={hkQueue.length > 0 ? 'red' : 'slate'}
            loading={loading}
            emptyMessage="Tất cả phòng sẵn sàng ✓"
            onSeeAll={goRooms}
          >
            {hkQueue.map((r) => (
              <RoomRow key={r.id} room={r} onClick={goRooms} />
            ))}
          </WidgetCard>

          <WidgetCard
            title="Xe máy trả hôm nay"
            count={data.report?.bike_returns_today.length ?? 0}
            icon={Bike}
            accent={data.report?.bike_returns_today.length ? 'purple' : 'slate'}
            loading={loading}
            emptyMessage="Không có xe trả hôm nay"
            onSeeAll={goBikes}
          >
            {data.report?.bike_returns_today.map((r) => (
              <BikeRow key={r.bike_rental_id} row={r} onClick={goBikes} />
            ))}
          </WidgetCard>

          {/* Occupancy summary tile */}
          <div className={cn('flex flex-col items-center justify-center rounded-xl border p-4 ring-1 ring-foreground/5', ACCENT.green.panel)}>
            <p className="text-4xl font-extrabold text-emerald-700">{occupancyPct}%</p>
            <p className={cn('mt-1 text-sm font-semibold', ACCENT.green.header)}>Công suất phòng</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.report?.in_house.length ?? 0} / {data.rooms.length} phòng đang có khách
            </p>
            {data.report?.tomorrow_arrivals && data.report.tomorrow_arrivals.length > 0 && (
              <div className="mt-3 w-full border-t pt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ngày mai ({data.report.tomorrow_arrivals.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.report.tomorrow_arrivals.slice(0, 4).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => goBooking(b.id)}
                      className="rounded-md border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      {b.room_number ? `P.${b.room_number}` : '—'} · {b.guest_name.split(' ').pop()}
                    </button>
                  ))}
                  {data.report.tomorrow_arrivals.length > 4 && (
                    <span className="rounded-md border bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
                      +{data.report.tomorrow_arrivals.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Activity Feed ── */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hoạt động gần đây
            </p>
            {data.activity.length > 0 && (
              <button
                onClick={() => goTab('all')}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Xem tất cả <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có hoạt động nào</p>
          ) : (
            <div className="rounded-xl border bg-card divide-y divide-border/50">
              {data.activity.map((log) => (
                <ActivityRow key={log.id} log={log} onClick={() => { if (log.booking_id != null) goBooking(log.booking_id) }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Room Map ── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sơ đồ phòng</p>
          <div className="mb-4 flex flex-wrap gap-3">
            {LEGEND.map(({ label, dot }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                {label}
              </span>
            ))}
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data.rooms.map((room) => <RoomCard key={room.id} room={room} />)}
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
