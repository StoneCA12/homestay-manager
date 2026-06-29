import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarBooking, Room } from '../../types'
import { formatDate } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'])
const INACTIVE_STATUSES = new Set(['CANCELLED', 'NO_SHOW'])
const DAY_NAMES_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
type ViewMode = 'grid' | 'gantt' | 'year'

// ─── Utilities ────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatDateVi(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ─── Data builders ────────────────────────────────────────────────────────────

interface DayBookings {
  arrivals: CalendarBooking[]
  departures: CalendarBooking[]
  inHouse: CalendarBooking[]
}

function buildGridData(bookings: CalendarBooking[]): Map<string, DayBookings> {
  const map = new Map<string, DayBookings>()
  const get = (iso: string): DayBookings => {
    if (!map.has(iso)) map.set(iso, { arrivals: [], departures: [], inHouse: [] })
    return map.get(iso)!
  }
  for (const b of bookings) {
    if (!ACTIVE_STATUSES.has(b.status)) continue
    let cur = new Date(b.check_in_date + 'T00:00:00')
    const end = new Date(b.check_out_date + 'T00:00:00')
    const ciISO = b.check_in_date
    const coISO = b.check_out_date
    get(ciISO).arrivals.push(b)
    while (cur < end) {
      const iso = toISO(cur)
      if (iso !== ciISO && iso !== coISO) get(iso).inHouse.push(b)
      cur = addDays(cur, 1)
    }
    get(coISO).departures.push(b)
  }
  return map
}

function buildCoverage(bookings: CalendarBooking[]): Map<string, CalendarBooking> {
  const map = new Map<string, CalendarBooking>()
  for (const b of bookings) {
    if (!ACTIVE_STATUSES.has(b.status)) continue
    let cur = new Date(b.check_in_date + 'T00:00:00')
    const end = new Date(b.check_out_date + 'T00:00:00')
    while (cur < end) {
      map.set(`${b.room_id}-${toISO(cur)}`, b)
      cur = addDays(cur, 1)
    }
  }
  return map
}

function buildOccupancyMap(bookings: CalendarBooking[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of bookings) {
    if (!ACTIVE_STATUSES.has(b.status)) continue
    let cur = new Date(b.check_in_date + 'T00:00:00')
    const end = new Date(b.check_out_date + 'T00:00:00')
    while (cur < end) {
      const key = toISO(cur)
      map.set(key, (map.get(key) ?? 0) + 1)
      cur = addDays(cur, 1)
    }
  }
  return map
}

function occupancyColor(count: number, totalRooms: number): string {
  if (count === 0) return 'bg-muted text-muted-foreground'
  const pct = totalRooms > 0 ? count / totalRooms : 0
  if (pct >= 0.75) return 'bg-red-200 text-red-700'
  if (pct >= 0.5)  return 'bg-orange-200 text-orange-700'
  if (pct >= 0.25) return 'bg-blue-200 text-blue-700'
  return 'bg-blue-100 text-blue-600'
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED:   'Đã đặt',
  CHECKED_IN:  'Đang ở',
  CHECKED_OUT: 'Đã trả',
}

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-muted text-muted-foreground',
}

function DayDetailPanel({
  date, data, onClose,
}: {
  date: string
  data: DayBookings
  onClose: () => void
}) {
  const total = data.arrivals.length + data.inHouse.length + data.departures.length

  const sections: Array<{
    kind: string; label: string; bookings: CalendarBooking[]
    dotColor: string; labelColor: string
  }> = [
    { kind: 'arrival',  label: 'Nhận phòng',  bookings: data.arrivals,   dotColor: 'bg-blue-500',  labelColor: 'text-blue-700'  },
    { kind: 'inhouse',  label: 'Đang ở',       bookings: data.inHouse,    dotColor: 'bg-emerald-500', labelColor: 'text-emerald-700' },
    { kind: 'departure',label: 'Trả phòng',   bookings: data.departures, dotColor: 'bg-slate-400', labelColor: 'text-muted-foreground' },
  ]

  return (
    <div className="sticky top-4 flex w-72 flex-shrink-0 flex-col self-start overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
        <div>
          <p className="text-sm font-bold capitalize text-foreground">{formatDateVi(date)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{total > 0 ? `${total} đặt phòng` : 'Không có đặt phòng'}</p>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          ×
        </button>
      </div>

      {total === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="mb-2 text-3xl">🏨</p>
          <p className="text-sm text-muted-foreground">Không có khách hôm nay</p>
        </div>
      ) : (
        <div className="max-h-[600px] divide-y divide-border overflow-y-auto">
          {sections.map(({ kind, label, bookings, dotColor, labelColor }) =>
            bookings.length === 0 ? null : (
              <div key={kind} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', dotColor)} />
                  <span className={cn('text-xs font-bold uppercase tracking-wide', labelColor)}>
                    {label} &nbsp;
                    <span className="font-normal text-muted-foreground">({bookings.length})</span>
                  </span>
                </div>
                <div className="space-y-2">
                  {bookings.map((b) => (
                    <div key={b.id} className="rounded-lg border bg-muted/40 px-3 py-2.5">
                      <div className="mb-1 flex items-start justify-between gap-1">
                        <span className="text-xs font-bold text-foreground">
                          {b.room_number ? `Phòng ${b.room_number}` : 'Chưa xếp phòng'}
                        </span>
                        <span className={cn('whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold', STATUS_BADGE[b.status] ?? 'bg-muted text-muted-foreground')}>
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-tight text-foreground">{b.guest_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(b.check_in_date)} → {formatDate(b.check_out_date)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  rooms: Room[]
  bookings: CalendarBooking[]
  monthStart: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  yearBookings?: CalendarBooking[]
  yearStart?: Date
  onPrevYear?: () => void
  onNextYear?: () => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingCalendar({
  rooms, bookings, monthStart,
  onPrevMonth, onNextMonth,
  yearBookings, yearStart, onPrevYear, onNextYear,
}: Props) {
  const { t } = useTranslation()
  const today = toISO(new Date())
  const [view, setView] = useState<ViewMode>('grid')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))
  const monthLabel = monthStart.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })

  const gridData = buildGridData(bookings)
  const coverage = buildCoverage(bookings)
  const inactiveBookings = bookings
    .filter((b) => INACTIVE_STATUSES.has(b.status))
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date))

  const displayYear = yearStart ? yearStart.getFullYear() : new Date().getFullYear()
  const occupancyMap = buildOccupancyMap(yearBookings ?? bookings)
  const totalRooms = rooms.length

  const toggleDate = (iso: string) => setSelectedDate((prev) => (prev === iso ? null : iso))
  const selectedDayData = selectedDate ? gridData.get(selectedDate) ?? { arrivals: [], departures: [], inHouse: [] } : null

  const VIEW_TABS: { key: ViewMode; label: string }[] = [
    { key: 'grid',  label: t('calendar.viewGrid') },
    { key: 'gantt', label: t('calendar.viewGantt') },
    { key: 'year',  label: t('calendar.viewYear') },
  ]

  const MonthNav = () => (
    <div className="mb-4 flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={onPrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="min-w-[180px] text-center text-base font-bold capitalize text-foreground">
        {monthLabel}
      </span>
      <Button variant="outline" size="icon" onClick={onNextMonth}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  )

  // ── Grid view ────────────────────────────────────────────────────────────────
  const renderGrid = () => (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <MonthNav />

        {/* Day-of-week header */}
        <div className="mb-1 grid grid-cols-7">
          {DAY_NAMES_SHORT.map((d, i) => (
            <div key={d} className={cn('py-1.5 text-center text-xs font-bold', i === 0 || i === 6 ? 'text-red-400' : 'text-muted-foreground')}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] bg-muted/40" />
          ))}

          {days.map((d) => {
            const iso = toISO(d)
            const isToday = iso === today
            const isSelected = selectedDate === iso
            const dayData = gridData.get(iso)
            const arrivals   = dayData?.arrivals   ?? []
            const departures = dayData?.departures ?? []
            const inHouse    = dayData?.inHouse    ?? []
            const hasActivity = arrivals.length + departures.length + inHouse.length > 0

            return (
              <div
                key={iso}
                onClick={() => toggleDate(iso)}
                className={cn(
                  'flex min-h-[80px] cursor-pointer select-none flex-col p-2 transition-colors',
                  isSelected
                    ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                    : isToday
                      ? 'bg-card ring-2 ring-inset ring-blue-300'
                      : 'bg-card hover:bg-muted/50'
                )}
              >
                <div className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', isToday ? 'bg-blue-500 text-white' : 'text-muted-foreground')}>
                  {d.getDate()}
                </div>

                {hasActivity && (
                  <div className="mt-auto flex flex-col gap-0.5">
                    {arrivals.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-semibold text-blue-700">{arrivals.length} nhận</span>
                      </div>
                    )}
                    {inHouse.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-emerald-700">{inHouse.length} đang ở</span>
                      </div>
                    )}
                    {departures.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                        <span className="text-[10px] text-muted-foreground">{departures.length} trả</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Nhận phòng</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Đang ở</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Trả phòng</span>
          <span className="ml-1 text-muted-foreground/60">Nhấn vào ngày để xem chi tiết</span>
        </div>

        {inactiveBookings.length > 0 && <CancelledSection bookings={inactiveBookings} />}
      </div>

      {selectedDate && selectedDayData && (
        <DayDetailPanel date={selectedDate} data={selectedDayData} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  )

  // ── Gantt view ────────────────────────────────────────────────────────────────
  const renderGantt = () => {
    const STATUS_COLOR: Record<string, string> = {
      CONFIRMED:   'bg-blue-300 text-blue-900',
      CHECKED_IN:  'bg-emerald-300 text-emerald-900',
      CHECKED_OUT: 'bg-muted text-muted-foreground',
    }
    return (
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <MonthNav />
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="border-collapse text-xs" style={{ minWidth: `${64 + daysInMonth * 36}px` }}>
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-10 w-16 border-b border-r bg-muted/50 px-2 py-2 text-left font-semibold text-muted-foreground">
                    Phòng
                  </th>
                  {days.map((d) => {
                    const iso = toISO(d)
                    const isToday = iso === today
                    const isSelected = selectedDate === iso
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6
                    return (
                      <th
                        key={iso}
                        onClick={() => toggleDate(iso)}
                        title={formatDateVi(iso)}
                        className={cn(
                          'w-9 cursor-pointer border-b border-r px-0 py-1 text-center font-medium transition-colors',
                          isSelected
                            ? 'bg-blue-100 text-blue-700'
                            : isToday
                              ? 'bg-blue-50 text-blue-600'
                              : isWeekend
                                ? 'bg-muted text-muted-foreground hover:bg-muted'
                                : 'text-muted-foreground hover:bg-muted/50'
                        )}
                      >
                        <div>{d.getDate()}</div>
                        <div className="text-[10px] opacity-60">{DAY_NAMES_SHORT[d.getDay()]}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-muted/30">
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r bg-card px-2 py-2 font-semibold text-foreground">
                      {room.room_number}
                    </td>
                    {days.map((d) => {
                      const iso = toISO(d)
                      const booking = coverage.get(`${room.id}-${iso}`)
                      const isCheckIn = booking?.check_in_date === iso
                      const isToday = iso === today
                      const isSelected = selectedDate === iso
                      return (
                        <td
                          key={iso}
                          onClick={() => toggleDate(iso)}
                          title={booking ? `${booking.guest_name} · ${booking.check_in_date} → ${booking.check_out_date}` : formatDateVi(iso)}
                          className={cn(
                            'h-8 w-9 cursor-pointer overflow-hidden border-b border-r px-0 transition-colors',
                            booking
                              ? STATUS_COLOR[booking.status] ?? 'bg-muted'
                              : isSelected
                                ? 'bg-blue-50'
                                : isToday
                                  ? 'bg-blue-50/50'
                                  : 'hover:bg-muted/50'
                          )}
                        >
                          {isCheckIn && booking && (
                            <span className="block truncate px-1 text-[10px] font-semibold leading-8">
                              {booking.guest_name.split(' ').slice(-1)[0]}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {[
              ['bg-blue-300',     'Đã đặt'],
              ['bg-emerald-300',  'Đang ở'],
              ['bg-muted',        'Đã trả'],
            ].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn('h-3 w-3 rounded-sm', color)} />
                {label}
              </span>
            ))}
            <span className="ml-1 text-muted-foreground/60">Nhấn cột ngày để xem chi tiết</span>
          </div>
          {inactiveBookings.length > 0 && <CancelledSection bookings={inactiveBookings} />}
        </div>

        {selectedDate && selectedDayData && (
          <DayDetailPanel date={selectedDate} data={selectedDayData} onClose={() => setSelectedDate(null)} />
        )}
      </div>
    )
  }

  // ── Year view ─────────────────────────────────────────────────────────────────
  const renderYear = () => (
    <div>
      <div className="mb-6 flex items-center gap-3">
        {onPrevYear && (
          <Button variant="outline" size="icon" onClick={onPrevYear}><ChevronLeft className="h-4 w-4" /></Button>
        )}
        <span className="min-w-[200px] text-center text-base font-bold text-foreground">
          {t('calendar.yearTitle', { year: displayYear })}
        </span>
        {onNextYear && (
          <Button variant="outline" size="icon" onClick={onNextYear}><ChevronRight className="h-4 w-4" /></Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, m) => {
          const mStart = new Date(displayYear, m, 1)
          const mDays = new Date(displayYear, m + 1, 0).getDate()
          const mLabel = mStart.toLocaleDateString('vi-VN', { month: 'long' })
          const mFirstDow = mStart.getDay()
          return (
            <div key={m} className="rounded-xl border bg-card p-3">
              <p className="mb-2 text-xs font-bold capitalize text-foreground">{mLabel}</p>
              <div className="grid grid-cols-7 gap-px">
                {DAY_NAMES_SHORT.map((d) => (
                  <div key={d} className="pb-0.5 text-center text-[9px] font-medium text-muted-foreground">{d}</div>
                ))}
                {Array.from({ length: mFirstDow }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: mDays }, (_, i) => {
                  const iso = toISO(new Date(displayYear, m, i + 1))
                  const count = occupancyMap.get(iso) ?? 0
                  const isToday = iso === today
                  return (
                    <div
                      key={iso}
                      title={count > 0 ? `${count} đặt phòng` : undefined}
                      className={cn('flex aspect-square w-full items-center justify-center rounded-sm text-[9px] font-medium transition-colors', occupancyColor(count, totalRooms), isToday && 'ring-1 ring-blue-500')}
                    >
                      {i + 1}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {[
          { color: 'bg-muted',      label: 'Trống'  },
          { color: 'bg-blue-100',   label: '1–25%'  },
          { color: 'bg-blue-200',   label: '25–50%' },
          { color: 'bg-orange-200', label: '50–75%' },
          { color: 'bg-red-200',    label: '≥75%'   },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded-sm', color)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      {/* View toggle */}
      <div className="mb-5 inline-flex w-fit gap-1 rounded-lg bg-muted p-1">
        {VIEW_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setView(key); setSelectedDate(null) }}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              view === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'grid'  && renderGrid()}
      {view === 'gantt' && renderGantt()}
      {view === 'year'  && renderYear()}
    </div>
  )
}

// ─── Cancelled bookings section ───────────────────────────────────────────────

function CancelledSection({ bookings }: { bookings: CalendarBooking[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-5 overflow-hidden rounded-xl border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <span>
          Đã hủy & Không đến
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {bookings.length}
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Phòng', 'Khách', 'Nhận phòng', 'Trả phòng', 'Trạng thái'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2.5 font-semibold text-foreground">{b.room_number ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{b.guest_name}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDate(b.check_in_date)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDate(b.check_out_date)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', b.status === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700')}>
                      {b.status === 'CANCELLED' ? 'Đã hủy' : 'Không đến'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
