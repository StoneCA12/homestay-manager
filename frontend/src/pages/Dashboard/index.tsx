import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import RoomCard from '../../components/rooms/RoomCard'
import { revenueApi, roomsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { BikeReturnRow, BookingSummaryRow, DailyReport, DashboardStats, Room } from '../../types'
import { formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      roomsApi.list(),
      roomsApi.stats(),
      revenueApi.dailyReport(),
    ])
      .then(([r, s, rep]) => { setRooms(r); setStats(s); setReport(rep) })
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const goBooking = (id: number) => navigate('/bookings', { state: { openBookingId: id } })
  const goBikes = () => navigate('/xe-may')

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6 p-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold capitalize tracking-tight text-foreground">{today}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Chào {user?.full_name?.split(' ').pop()} — đây là tình hình hôm nay
            </p>
          </div>
        </div>

        {/* ── Stat chips ── */}
        {stats && (
          <div className="flex flex-wrap gap-2">
            <Chip label="Phòng" value={`${stats.occupied}/${stats.total_rooms}`} color="green" />
            <Chip label="Nhận phòng" value={stats.arrivals_today} color="yellow" />
            <Chip label="Trả phòng" value={stats.checkouts_today} color="blue" />
            <Chip label="Cần dọn" value={stats.dirty} color={stats.dirty > 0 ? 'red' : 'slate'} />
            {report && <Chip label="Xe đang thuê" value={report.active_bike_count} color={report.active_bike_count > 0 ? 'purple' : 'slate'} onClick={goBikes} />}
            {report && Number(report.revenue.outstanding) > 0 && (
              <Chip label="Còn nợ" value={formatVND(report.revenue.outstanding)} color="red" onClick={() => navigate('/bookings')} />
            )}
          </div>
        )}

        {/* ── Occupancy warning ── */}
        {stats && stats.occupancy_warning_dates.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Cảnh báo kín phòng sắp tới</p>
              <p className="mt-0.5 font-normal text-amber-700">
                {stats.occupancy_warning_dates.map((d) =>
                  new Date(d).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })
                ).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        )}

        {!loading && report && (
          <>
            {/* ── Today's ops grid ── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <OpsPanel title="Nhận phòng hôm nay" icon="⬇️" count={report.arrivals.length} emptyText="Không có khách nhận phòng hôm nay" accentColor="yellow">
                {report.arrivals.map((b) => (
                  <BookingRow key={b.id} row={b} onClick={() => goBooking(b.id)} />
                ))}
              </OpsPanel>

              <OpsPanel title="Trả phòng hôm nay" icon="⬆️" count={report.departures.length} emptyText="Không có khách trả phòng hôm nay" accentColor="blue">
                {report.departures.map((b) => (
                  <BookingRow key={b.id} row={b} onClick={() => goBooking(b.id)} />
                ))}
              </OpsPanel>

              <OpsPanel title="Đang lưu trú" icon="🏠" count={report.in_house.length} emptyText="Không có khách đang lưu trú" accentColor="green">
                {report.in_house.map((b) => (
                  <BookingRow key={b.id} row={b} onClick={() => goBooking(b.id)} showCheckout />
                ))}
              </OpsPanel>

              {report.bike_returns_today.length > 0 ? (
                <OpsPanel title="Xe máy trả hôm nay" icon="🏍️" count={report.bike_returns_today.length} accentColor="purple">
                  {report.bike_returns_today.map((r) => (
                    <BikeReturnRowItem key={r.bike_rental_id} row={r} onClick={goBikes} />
                  ))}
                </OpsPanel>
              ) : report.active_bike_count > 0 ? (
                <OpsPanel title="Xe máy đang thuê" icon="🏍️" count={report.active_bike_count} emptyText="" accentColor="purple">
                  <p className="py-1 text-sm text-muted-foreground">
                    {report.active_bike_count} xe đang được thuê — không có xe trả hôm nay
                  </p>
                </OpsPanel>
              ) : (
                <OpsPanel title="Xe máy" icon="🏍️" count={0} emptyText="Không có xe đang thuê" accentColor="slate" />
              )}

            </div>

            {/* ── Tomorrow arrivals (compact) ── */}
            {report.tomorrow_arrivals.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nhận phòng ngày mai ({report.tomorrow_arrivals.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {report.tomorrow_arrivals.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => goBooking(b.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <span className="font-semibold text-foreground">{b.room_number ? `P.${b.room_number}` : '—'}</span>
                      <span>{b.guest_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Room grid ── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sơ đồ phòng</p>
          {/* Legend */}
          <div className="mb-4 flex flex-wrap gap-3">
            {LEGEND.map(({ label, dot }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </div>

      </div>
    </Layout>
  )
}

// ── Sub-components ─────────────────────────────────────────────

const ACCENT: Record<string, { panel: string; badge: string; header: string }> = {
  yellow: { panel: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-700', header: 'text-amber-700' },
  blue:   { panel: 'border-blue-200 bg-blue-50/40',   badge: 'bg-blue-100 text-blue-700',   header: 'text-blue-700'  },
  green:  { panel: 'border-emerald-200 bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-700', header: 'text-emerald-700' },
  purple: { panel: 'border-purple-200 bg-purple-50/40', badge: 'bg-purple-100 text-purple-700', header: 'text-purple-700' },
  red:    { panel: 'border-red-200 bg-red-50/40',     badge: 'bg-red-100 text-red-700',     header: 'text-red-700'   },
  slate:  { panel: 'border-border bg-muted/30',       badge: 'bg-muted text-muted-foreground', header: 'text-muted-foreground' },
}

function OpsPanel({
  title, icon, count, children, emptyText, accentColor,
}: {
  title: string
  icon: string
  count: number
  children?: React.ReactNode
  emptyText?: string
  accentColor: keyof typeof ACCENT
}) {
  const c = ACCENT[accentColor]
  return (
    <div className={cn('rounded-xl border p-4 ring-1 ring-foreground/5', c.panel)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <p className={cn('text-sm font-semibold', c.header)}>{title}</p>
        </div>
        {count > 0 && (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', c.badge)}>{count}</span>
        )}
      </div>
      {count === 0 && emptyText ? (
        <p className="py-1 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border/60">{children}</div>
      )}
    </div>
  )
}

function BookingRow({
  row, onClick, showCheckout,
}: {
  row: BookingSummaryRow
  onClick: () => void
  showCheckout?: boolean
}) {
  const outstanding = Number(row.total_price) - Number(row.collected_amount)
  const bikeOutstanding = Number(row.bike_outstanding)
  const totalOwed = outstanding + bikeOutstanding

  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-background/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">
              {row.room_number ? `P.${row.room_number}` : '—'}
            </span>
            <span className="truncate text-sm text-muted-foreground">{row.guest_name}</span>
          </div>
          {showCheckout && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Trả: {new Date(row.check_out_date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
            </p>
          )}
          {row.bike_names.length > 0 && (
            <p className="mt-0.5 text-xs text-purple-600">🏍️ {row.bike_names.join(', ')}</p>
          )}
        </div>
        {totalOwed > 0 ? (
          <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
            Còn {formatVND(totalOwed)}
          </span>
        ) : (
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
      </div>
    </button>
  )
}

function BikeReturnRowItem({ row, onClick }: { row: BikeReturnRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-background/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-purple-700">{row.bike_name}</span>
            {row.plate_number && (
              <span className="font-mono text-xs text-muted-foreground">{row.plate_number}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.room_number ? `P.${row.room_number}` : '—'} · {row.guest_name}
          </p>
        </div>
        {Number(row.outstanding) > 0 ? (
          <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
            Còn {formatVND(row.outstanding)}
          </span>
        ) : (
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
      </div>
    </button>
  )
}

function Chip({
  label, value, color, onClick,
}: {
  label: string
  value: string | number
  color: string
  onClick?: () => void
}) {
  const colors: Record<string, string> = {
    green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    yellow: 'bg-amber-50   border-amber-200   text-amber-700',
    blue:   'bg-blue-50    border-blue-200    text-blue-700',
    red:    'bg-red-50     border-red-200     text-red-700',
    purple: 'bg-purple-50  border-purple-200  text-purple-700',
    slate:  'bg-muted/40   border-border      text-muted-foreground',
  }
  const cls = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
    colors[color] ?? colors.slate,
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
