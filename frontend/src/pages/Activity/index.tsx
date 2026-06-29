import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Banknote, Bike, CalendarPlus, ChevronLeft, ChevronRight,
  LogIn, LogOut, RefreshCw, Sparkles, X,
} from 'lucide-react'
import Layout from '../../components/layout/Layout'
import { activityApi } from '../../services/api'
import type { ActivityItem } from '../../types'
import { cn } from '@/lib/utils'

// ── Event config ────────────────────────────────────────────────

interface EventConfig { label: string; icon: React.ElementType; color: string; bg: string }

const EVENT_CONFIG: Record<string, EventConfig> = {
  BOOKING_CREATED: { label: 'Đặt phòng mới',  icon: CalendarPlus, color: 'text-blue-700',    bg: 'bg-blue-100' },
  CHECKED_IN:      { label: 'Nhận phòng',      icon: LogIn,        color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CHECKED_OUT:     { label: 'Trả phòng',       icon: LogOut,       color: 'text-blue-700',    bg: 'bg-blue-100' },
  CANCELLED:       { label: 'Hủy đặt phòng',  icon: X,            color: 'text-red-700',     bg: 'bg-red-100' },
  NO_SHOW:         { label: 'Không đến',       icon: X,            color: 'text-orange-700',  bg: 'bg-orange-100' },
  PAYMENT:         { label: 'Thanh toán',      icon: Banknote,     color: 'text-violet-700',  bg: 'bg-violet-100' },
  ROOM_STATUS:     { label: 'Dọn phòng',       icon: Sparkles,     color: 'text-amber-700',   bg: 'bg-amber-100' },
  BIKE_ASSIGNED:   { label: 'Cho thuê xe',     icon: Bike,         color: 'text-purple-700',  bg: 'bg-purple-100' },
  BIKE_RETURNED:   { label: 'Trả xe',          icon: Bike,         color: 'text-purple-700',  bg: 'bg-purple-100' },
}

const fallbackConfig: EventConfig = {
  label: 'Sự kiện', icon: CalendarPlus, color: 'text-slate-600', bg: 'bg-slate-100',
}

// ── Filter groups ───────────────────────────────────────────────

type FilterGroup = 'all' | 'booking' | 'checkin' | 'checkout' | 'cancel' | 'payment' | 'room' | 'bike'

const FILTER_LABELS: Record<FilterGroup, string> = {
  all:     'Tất cả',
  booking: 'Đặt phòng mới',
  checkin: 'Nhận phòng',
  checkout: 'Trả phòng',
  cancel:  'Hủy',
  payment: 'Thanh toán',
  room:    'Dọn phòng',
  bike:    'Xe máy',
}

const FILTER_TYPES: Record<FilterGroup, string[]> = {
  all:      [],
  booking:  ['BOOKING_CREATED'],
  checkin:  ['CHECKED_IN'],
  checkout: ['CHECKED_OUT'],
  cancel:   ['CANCELLED', 'NO_SHOW'],
  payment:  ['PAYMENT'],
  room:     ['ROOM_STATUS'],
  bike:     ['BIKE_ASSIGNED', 'BIKE_RETURNED'],
}

// ── Helpers ─────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(isoFull: string): string {
  return new Date(isoFull).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

// ── Main page ────────────────────────────────────────────────────

export default function ActivityPage() {
  const navigate = useNavigate()
  const [date, setDate] = useState(isoDate(new Date()))
  const [filter, setFilter] = useState<FilterGroup>('all')
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const today = isoDate(new Date())

  const fetchItems = useCallback(async (d: string, manual = false) => {
    if (manual) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await activityApi.list({ date: d, limit: 200 })
      setItems(data)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchItems(date) }, [date, fetchItems])

  const filteredItems = useMemo(() => {
    const types = FILTER_TYPES[filter]
    if (types.length === 0) return items
    return items.filter((i) => types.includes(i.event_type))
  }, [items, filter])

  const counts = useMemo(() => {
    const c: Partial<Record<FilterGroup, number>> = {}
    for (const [group, types] of Object.entries(FILTER_TYPES) as [FilterGroup, string[]][]) {
      if (types.length === 0) continue
      c[group] = items.filter((i) => types.includes(i.event_type)).length
    }
    return c
  }, [items])

  const goBooking = (id: number) => navigate('/bookings', { state: { openBookingId: id } })
  const isToday = date === today
  const isFuture = date >= today

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-4 p-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Nhật ký hoạt động</h1>
          <button
            onClick={() => fetchItems(date, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Làm mới
          </button>
        </div>

        {/* ── Date navigation ── */}
        <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Trước
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold capitalize text-foreground">{formatDate(date)}</p>
            {isToday && (
              <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Hôm nay
              </span>
            )}
          </div>

          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={isFuture}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Sau <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* ── Jump to today ── */}
        {!isToday && (
          <button
            onClick={() => setDate(today)}
            className="w-full rounded-xl border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            Về hôm nay
          </button>
        )}

        {/* ── Filter chips ── */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as FilterGroup[]).map((g) => {
            const count = g === 'all' ? items.length : (counts[g] ?? 0)
            const active = filter === g
            return (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {FILTER_LABELS[g]}
                {count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Feed ── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {items.length === 0
                ? 'Không có hoạt động nào trong ngày này'
                : `Không có sự kiện "${FILTER_LABELS[filter]}" trong ngày này`}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {filteredItems.map((item, idx) => {
              const cfg = EVENT_CONFIG[item.event_type] ?? fallbackConfig
              const Icon = cfg.icon
              const isLast = idx === filteredItems.length - 1
              return (
                <button
                  key={item.id}
                  onClick={() => item.booking_id ? goBooking(item.booking_id) : undefined}
                  disabled={!item.booking_id}
                  className={cn(
                    'flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors',
                    item.booking_id ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default',
                    !isLast && 'border-b border-border/50',
                  )}
                >
                  {/* Icon */}
                  <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cfg.bg)}>
                    <Icon className={cn('h-4 w-4', cfg.color)} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className={cn('text-[11px] font-semibold', cfg.color)}>{cfg.label}</span>
                        {item.room_number && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">P.{item.room_number}</span>
                        )}
                        <p className="mt-0.5 text-sm text-foreground leading-snug">{item.description}</p>
                      </div>
                      <time className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {formatTime(item.created_at)}
                      </time>
                    </div>
                    {item.actor_name && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{item.actor_name}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Count footer ── */}
        {!loading && filteredItems.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {filteredItems.length} sự kiện{filter !== 'all' ? ` · ${items.length} tổng cộng trong ngày` : ''}
          </p>
        )}
      </div>
    </Layout>
  )
}
