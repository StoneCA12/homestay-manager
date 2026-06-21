import { useState } from 'react'
import type { CalendarBooking, Room } from '../../types'
import { formatDate } from '../../utils/format'

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED:   'bg-blue-300 text-blue-900',
  CHECKED_IN:  'bg-green-300 text-green-900',
  CHECKED_OUT: 'bg-gray-300 text-gray-700',
}

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'])
const INACTIVE_STATUSES = new Set(['CANCELLED', 'NO_SHOW'])

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
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

interface Props {
  rooms: Room[]
  bookings: CalendarBooking[]
  monthStart: Date
  onPrevMonth: () => void
  onNextMonth: () => void
}

export default function BookingCalendar({ rooms, bookings, monthStart, onPrevMonth, onNextMonth }: Props) {
  const today = toISO(new Date())
  const [showCancelled, setShowCancelled] = useState(false)

  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: Date[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i))
  }

  const coverage = buildCoverage(bookings)
  const inactiveBookings = bookings.filter((b) => INACTIVE_STATUSES.has(b.status))
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date))

  const monthLabel = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onPrevMonth} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          ← Prev
        </button>
        <span className="text-base font-semibold text-slate-800 min-w-[160px] text-center">{monthLabel}</span>
        <button onClick={onNextMonth} className="px-3 py-1.5 text-sm border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
          Next →
        </button>
      </div>

      {/* Main Gantt grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="text-xs border-collapse" style={{ minWidth: `${64 + daysInMonth * 36}px` }}>
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 w-16 px-2 py-1.5 text-left text-slate-500 font-semibold border-b border-r border-gray-200">Room</th>
              {days.map((d) => {
                const iso = toISO(d)
                const isToday = iso === today
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                return (
                  <th
                    key={iso}
                    className={`w-9 px-0 py-1 text-center font-medium border-b border-r border-gray-200 ${
                      isToday ? 'bg-blue-50 text-blue-700' : isWeekend ? 'bg-slate-100 text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    <div>{d.getDate()}</div>
                    <div className="text-[10px] opacity-70">{DAY_NAMES[d.getDay()]}</div>
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

                  return (
                    <td
                      key={iso}
                      title={booking ? `${booking.guest_name} · ${booking.check_in_date} → ${booking.check_out_date} · ${booking.status}` : undefined}
                      className={`w-9 h-8 px-0 border-b border-r border-gray-200 overflow-hidden ${
                        booking
                          ? STATUS_COLOR[booking.status] ?? 'bg-gray-200'
                          : isToday ? 'bg-blue-50' : ''
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

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-slate-500">
        {Object.entries({ CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked In', CHECKED_OUT: 'Checked Out' }).map(([s, label]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${STATUS_COLOR[s]}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Cancelled & No-shows section */}
      {inactiveBookings.length > 0 && (
        <div className="mt-5 border border-gray-200 rounded-xl bg-white overflow-hidden">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <span>
              Cancelled & No-shows
              <span className="ml-2 text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{inactiveBookings.length}</span>
            </span>
            <span className="text-slate-400">{showCancelled ? '▲' : '▼'}</span>
          </button>

          {showCancelled && (
            <div className="border-t border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Room', 'Guest', 'Check-in', 'Check-out', 'Status', 'Notes'].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inactiveBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-slate-700">{b.room_number}</td>
                      <td className="px-4 py-2.5 text-slate-600">{b.guest_name}</td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(b.check_in_date)}</td>
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{formatDate(b.check_out_date)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          b.status === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {b.status === 'NO_SHOW' ? 'No-show' : 'Cancelled'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
