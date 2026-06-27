import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarBooking, Room } from '../../types'
import { formatDate } from '../../utils/format'

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
  if (count === 0) return 'bg-slate-100 text-slate-400'
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
  CHECKED_IN:  'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
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
    { kind: 'inhouse',  label: 'Đang ở',       bookings: data.inHouse,    dotColor: 'bg-green-500', labelColor: 'text-green-700' },
    { kind: 'departure',label: 'Trả phòng',   bookings: data.departures, dotColor: 'bg-slate-400', labelColor: 'text-slate-600' },
  ]

  return (
    <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col self-start sticky top-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-slate-50">
        <div>
          <p className="text-sm font-bold text-slate-800 capitalize">{formatDateVi(date)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{total > 0 ? `${total} đặt phòng` : 'Không có đặt phòng'}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full text-lg transition-colors"
        >
          ×
        </button>
      </div>

      {total === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-3xl mb-2">🏨</p>
          <p className="text-sm text-slate-400">Không có khách hôm nay</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[600px] divide-y divide-gray-100">
          {sections.map(({ kind, label, bookings, dotColor, labelColor }) =>
            bookings.length === 0 ? null : (
              <div key={kind} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                  <span className={`text-xs font-bold uppercase tracking-wide ${labelColor}`}>
                    {label} &nbsp;
                    <span className="font-normal text-slate-500">({bookings.length})</span>
                  </span>
                </div>
                <div className="space-y-2">
                  {bookings.map((b) => (
                    <div key={b.id} className="rounded-lg border border-gray-100 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-slate-700">
                          {b.room_number ? `Phòng ${b.room_number}` : 'Chưa xếp phòng'}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 leading-tight">{b.guest_name}</p>
                      <p className="text-xs text-slate-400 mt-1">
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

  // ── View toggle ──────────────────────────────────────────────────────────────
  const VIEW_TABS: { key: ViewMode; label: string }[] = [
    { key: 'grid',  label: t('calendar.viewGrid') },
    { key: 'gantt', label: t('calendar.viewGantt') },
    { key: 'year',  label: t('calendar.viewYear') },
  ]

  // ── Month navigator ──────────────────────────────────────────────────────────
  const MonthNav = () => (
    <div className="flex items-center gap-3 mb-4">
      <button
        onClick={onPrevMonth}
        className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
      >‹</button>
      <span className="text-base font-bold text-slate-800 min-w-[180px] text-center capitalize">
        {monthLabel}
      </span>
      <button
        onClick={onNextMonth}
        className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
      >›</button>
    </div>
  )

  // ── Grid view ────────────────────────────────────────────────────────────────
  const renderGrid = () => (
    <div className="flex gap-4 items-start">
      {/* Calendar */}
      <div className="flex-1 min-w-0">
        <MonthNav />

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES_SHORT.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-bold py-1.5 ${i === 0 || i === 6 ? 'text-red-400' : 'text-slate-400'}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-50 min-h-[80px]" />
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
                className={`min-h-[80px] p-2 flex flex-col cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                    : isToday
                      ? 'bg-white ring-2 ring-inset ring-blue-300'
                      : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Date number */}
                <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                  isToday ? 'bg-blue-500 text-white' : 'text-slate-600'
                }`}>
                  {d.getDate()}
                </div>

                {/* Activity indicators */}
                {hasActivity && (
                  <div className="flex flex-col gap-0.5 mt-auto">
                    {arrivals.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-blue-700">
                          {arrivals.length} nhận
                        </span>
                      </div>
                    )}
                    {inHouse.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-[10px] text-green-700">
                          {inHouse.length} đang ở
                        </span>
                      </div>
                    )}
                    {departures.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                        <span className="text-[10px] text-slate-600">
                          {departures.length} trả
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 text-xs text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Nhận phòng
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Đang ở
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Trả phòng
          </span>
          <span className="text-slate-300 ml-1">Nhấn vào ngày để xem chi tiết</span>
        </div>

        {inactiveBookings.length > 0 && <CancelledSection bookings={inactiveBookings} />}
      </div>

      {/* Day detail panel */}
      {selectedDate && selectedDayData && (
        <DayDetailPanel
          date={selectedDate}
          data={selectedDayData}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  )

  // ── Gantt view ────────────────────────────────────────────────────────────────
  const renderGantt = () => {
    const STATUS_COLOR: Record<string, string> = {
      CONFIRMED:   'bg-blue-300 text-blue-900',
      CHECKED_IN:  'bg-green-300 text-green-900',
      CHECKED_OUT: 'bg-gray-200 text-gray-600',
    }
    return (
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <MonthNav />
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table
              className="text-xs border-collapse"
              style={{ minWidth: `${64 + daysInMonth * 36}px` }}
            >
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-10 bg-slate-50 w-16 px-2 py-2 text-left text-slate-500 font-semibold border-b border-r border-gray-200">
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
                        className={`w-9 px-0 py-1 text-center font-medium border-b border-r border-gray-200 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700'
                            : isToday
                              ? 'bg-blue-50 text-blue-600'
                              : isWeekend
                                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                : 'text-slate-400 hover:bg-slate-50'
                        }`}
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
                  <tr key={room.id} className="hover:bg-slate-50/50">
                    <td className="sticky left-0 z-10 bg-white px-2 py-2 font-semibold text-slate-700 border-b border-r border-gray-200 whitespace-nowrap">
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
                          className={`w-9 h-8 px-0 border-b border-r border-gray-200 overflow-hidden cursor-pointer transition-colors ${
                            booking
                              ? STATUS_COLOR[booking.status] ?? 'bg-gray-200'
                              : isSelected
                                ? 'bg-blue-50'
                                : isToday
                                  ? 'bg-blue-50/50'
                                  : 'hover:bg-slate-50'
                          }`}
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
          <div className="flex gap-4 mt-3 text-xs text-slate-400">
            {[
              ['bg-blue-300',  'Đã đặt'],
              ['bg-green-300', 'Đang ở'],
              ['bg-gray-200',  'Đã trả'],
            ].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${color}`} />
                {label}
              </span>
            ))}
            <span className="text-slate-300 ml-1">Nhấn cột ngày để xem chi tiết</span>
          </div>
          {inactiveBookings.length > 0 && <CancelledSection bookings={inactiveBookings} />}
        </div>

        {selectedDate && selectedDayData && (
          <DayDetailPanel
            date={selectedDate}
            data={selectedDayData}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </div>
    )
  }

  // ── Year view ─────────────────────────────────────────────────────────────────
  const renderYear = () => (
    <div>
      <div className="flex items-center gap-3 mb-6">
        {onPrevYear && (
          <button
            onClick={onPrevYear}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
          >‹</button>
        )}
        <span className="text-base font-bold text-slate-800 min-w-[200px] text-center">
          {t('calendar.yearTitle', { year: displayYear })}
        </span>
        {onNextYear && (
          <button
            onClick={onNextYear}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors"
          >›</button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, m) => {
          const mStart = new Date(displayYear, m, 1)
          const mDays = new Date(displayYear, m + 1, 0).getDate()
          const mLabel = mStart.toLocaleDateString('vi-VN', { month: 'long' })
          const mFirstDow = mStart.getDay()
          return (
            <div key={m} className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-700 mb-2 capitalize">{mLabel}</p>
              <div className="grid grid-cols-7 gap-px">
                {DAY_NAMES_SHORT.map((d) => (
                  <div key={d} className="text-center text-[9px] text-slate-400 font-medium pb-0.5">{d}</div>
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
                      className={`w-full aspect-square rounded-sm text-[9px] flex items-center justify-center font-medium transition-colors ${occupancyColor(count, totalRooms)} ${isToday ? 'ring-1 ring-blue-500' : ''}`}
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

      <div className="flex gap-4 mt-4 text-xs text-slate-400 flex-wrap">
        {[
          { color: 'bg-slate-100',   label: 'Trống'  },
          { color: 'bg-blue-100',    label: '1–25%'  },
          { color: 'bg-blue-200',    label: '25–50%' },
          { color: 'bg-orange-200',  label: '50–75%' },
          { color: 'bg-red-200',     label: '≥75%'   },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${color}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {VIEW_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setView(key); setSelectedDate(null) }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
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
    <div className="mt-5 border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <span>
          Đã hủy & Không đến
          <span className="ml-2 text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {bookings.length}
          </span>
        </span>
        <span className="text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Phòng', 'Khách', 'Nhận phòng', 'Trả phòng', 'Trạng thái'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-700">{b.room_number ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{b.guest_name}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(b.check_in_date)}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(b.check_out_date)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      b.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
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
