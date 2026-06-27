import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import RoomCard from '../../components/rooms/RoomCard'
import { revenueApi, roomsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { BikeReturnRow, BookingSummaryRow, DailyReport, DashboardStats, Room } from '../../types'
import { formatVND } from '../../utils/format'

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

  const goBooking = (_id: number) => navigate('/bookings')
  const goBikes = () => navigate('/xe-may')

  return (
    <Layout>
      <div className="p-6 max-w-6xl space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 capitalize">{today}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Chào {user?.full_name?.split(' ').pop()} — đây là tình hình hôm nay</p>
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
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 text-orange-800 text-sm px-4 py-3 rounded-xl">
            <span className="mt-0.5">🔴</span>
            <div>
              <p className="font-semibold">Cảnh báo kín phòng sắp tới</p>
              <p className="font-normal mt-0.5 text-orange-700">
                {stats.occupancy_warning_dates.map((d) =>
                  new Date(d).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })
                ).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 h-40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && report && (
          <>
            {/* ── Today's ops grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Nhận phòng hôm nay */}
              <OpsPanel
                title="Nhận phòng hôm nay"
                icon="⬇️"
                count={report.arrivals.length}
                emptyText="Không có khách nhận phòng hôm nay"
                accentColor="yellow"
              >
                {report.arrivals.map((b) => (
                  <BookingRow key={b.id} row={b} onClick={() => goBooking(b.id)} />
                ))}
              </OpsPanel>

              {/* Trả phòng hôm nay */}
              <OpsPanel
                title="Trả phòng hôm nay"
                icon="⬆️"
                count={report.departures.length}
                emptyText="Không có khách trả phòng hôm nay"
                accentColor="blue"
              >
                {report.departures.map((b) => (
                  <BookingRow key={b.id} row={b} onClick={() => goBooking(b.id)} />
                ))}
              </OpsPanel>

              {/* Đang ở */}
              <OpsPanel
                title="Đang lưu trú"
                icon="🏠"
                count={report.in_house.length}
                emptyText="Không có khách đang lưu trú"
                accentColor="green"
              >
                {report.in_house.map((b) => (
                  <BookingRow key={b.id} row={b} onClick={() => goBooking(b.id)} showCheckout />
                ))}
              </OpsPanel>

              {/* Xe máy trả hôm nay — only shows when relevant */}
              {report.bike_returns_today.length > 0 ? (
                <OpsPanel
                  title="Xe máy trả hôm nay"
                  icon="🏍️"
                  count={report.bike_returns_today.length}
                  accentColor="purple"
                >
                  {report.bike_returns_today.map((r) => (
                    <BikeReturnRowItem key={r.bike_rental_id} row={r} onClick={goBikes} />
                  ))}
                </OpsPanel>
              ) : report.active_bike_count > 0 ? (
                <OpsPanel
                  title="Xe máy đang thuê"
                  icon="🏍️"
                  count={report.active_bike_count}
                  emptyText=""
                  accentColor="purple"
                >
                  <p className="text-sm text-slate-500 py-1">
                    {report.active_bike_count} xe đang được thuê — không có xe trả hôm nay
                  </p>
                </OpsPanel>
              ) : null}

            </div>

            {/* ── Tomorrow arrivals (compact) ── */}
            {report.tomorrow_arrivals.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Nhận phòng ngày mai ({report.tomorrow_arrivals.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {report.tomorrow_arrivals.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => goBooking(b.id)}
                      className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <span className="font-semibold">{b.room_number ? `P.${b.room_number}` : '—'}</span>
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sơ đồ phòng</p>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {LEGEND.map(({ label, dot }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
  yellow: { panel: 'border-yellow-200 bg-yellow-50/40', badge: 'bg-yellow-100 text-yellow-700', header: 'text-yellow-700' },
  blue:   { panel: 'border-blue-200 bg-blue-50/40',     badge: 'bg-blue-100 text-blue-700',     header: 'text-blue-700'   },
  green:  { panel: 'border-green-200 bg-green-50/40',   badge: 'bg-green-100 text-green-700',   header: 'text-green-700'  },
  purple: { panel: 'border-purple-200 bg-purple-50/40', badge: 'bg-purple-100 text-purple-700', header: 'text-purple-700' },
  red:    { panel: 'border-red-200 bg-red-50/40',       badge: 'bg-red-100 text-red-700',       header: 'text-red-700'    },
  slate:  { panel: 'border-slate-200 bg-slate-50/40',   badge: 'bg-slate-100 text-slate-600',   header: 'text-slate-600'  },
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
    <div className={`rounded-2xl border ${c.panel} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <p className={`text-sm font-bold ${c.header}`}>{title}</p>
        </div>
        {count > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{count}</span>
        )}
      </div>
      {count === 0 && emptyText ? (
        <p className="text-xs text-slate-400 py-1">{emptyText}</p>
      ) : (
        <div className="space-y-0 divide-y divide-slate-100">{children}</div>
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
      className="w-full text-left py-2.5 hover:bg-white/60 rounded-xl px-1 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-700">
              {row.room_number ? `P.${row.room_number}` : '—'}
            </span>
            <span className="text-sm text-slate-600 truncate">{row.guest_name}</span>
          </div>
          {showCheckout && (
            <p className="text-xs text-slate-400 mt-0.5">
              Trả: {new Date(row.check_out_date).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })}
            </p>
          )}
          {row.bike_names.length > 0 && (
            <p className="text-xs text-purple-600 mt-0.5">
              🏍️ {row.bike_names.join(', ')}
            </p>
          )}
        </div>
        {totalOwed > 0 && (
          <span className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            Còn {formatVND(totalOwed)}
          </span>
        )}
        {totalOwed <= 0 && (
          <span className="flex-shrink-0 text-xs font-semibold text-green-600">✓</span>
        )}
      </div>
    </button>
  )
}

function BikeReturnRowItem({ row, onClick }: { row: BikeReturnRow; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left py-2.5 hover:bg-white/60 rounded-xl px-1 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-purple-700">{row.bike_name}</span>
            {row.plate_number && (
              <span className="text-xs text-slate-400 font-mono">{row.plate_number}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {row.room_number ? `P.${row.room_number}` : '—'} · {row.guest_name}
          </p>
        </div>
        {Number(row.outstanding) > 0 && (
          <span className="flex-shrink-0 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            Còn {formatVND(row.outstanding)}
          </span>
        )}
        {Number(row.outstanding) <= 0 && (
          <span className="flex-shrink-0 text-xs font-semibold text-green-600">✓</span>
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
    green:  'bg-green-50  border-green-200  text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    blue:   'bg-blue-50   border-blue-200   text-blue-700',
    red:    'bg-red-50    border-red-200    text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    slate:  'bg-slate-50  border-slate-200  text-slate-500',
  }
  const cls = `inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs font-semibold ${colors[color] ?? colors.slate} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`

  return onClick
    ? <button onClick={onClick} className={cls}><span className="text-sm font-bold">{value}</span>{label}</button>
    : <span className={cls}><span className="text-sm font-bold">{value}</span>{label}</span>
}

const LEGEND = [
  { label: 'Đang ở',          dot: 'bg-green-500'  },
  { label: 'Nhận hôm nay',    dot: 'bg-yellow-400' },
  { label: 'Trả hôm nay',     dot: 'bg-blue-500'   },
  { label: 'Cần dọn',         dot: 'bg-red-500'    },
  { label: 'Đang dọn',        dot: 'bg-orange-400' },
  { label: 'Ngừng hoạt động', dot: 'bg-gray-400'   },
  { label: 'Trống',           dot: 'bg-gray-300'   },
] as const
