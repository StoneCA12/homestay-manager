import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

// Build a 6-row grid of dates for the given month, including the leading/trailing
// days from adjacent months needed to fill full weeks (Sunday-first, matching the
// convention already used in BookingCalendar.tsx).
function buildMonthGrid(monthStart: Date): Date[] {
  const start = new Date(monthStart)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

interface Props {
  checkIn: string
  checkOut: string
  onChange: (checkIn: string, checkOut: string) => void
}

export default function DateRangePicker({ checkIn, checkOut, onChange }: Props) {
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(checkIn ? new Date(checkIn + 'T00:00:00') : new Date()))

  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])
  const todayIso = toISO(new Date())

  const handleDayClick = (iso: string) => {
    if (!checkIn || checkOut) {
      onChange(iso, '')
      return
    }
    if (iso <= checkIn) {
      onChange(iso, '')
      return
    }
    onChange(checkIn, iso)
  }

  return (
    <div className="rounded-xl border border-input bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DAY_NAMES.map((d) => (
          <span key={d} className="text-[10px] font-semibold uppercase text-muted-foreground">{d}</span>
        ))}
        {days.map((d) => {
          const iso = toISO(d)
          const inMonth = d.getMonth() === viewMonth.getMonth()
          const isCheckIn = iso === checkIn
          const isCheckOut = iso === checkOut
          const inRange = !!checkIn && !!checkOut && iso > checkIn && iso < checkOut
          const isPast = iso < todayIso

          return (
            <button
              key={iso}
              type="button"
              disabled={!inMonth}
              onClick={() => handleDayClick(iso)}
              className={cn(
                'h-10 rounded-lg text-xs transition-colors',
                !inMonth && 'invisible',
                inMonth && !isCheckIn && !isCheckOut && !inRange && 'hover:bg-muted',
                isPast && inMonth && !isCheckIn && !isCheckOut && 'text-muted-foreground/50',
                !isPast && inMonth && !isCheckIn && !isCheckOut && !inRange && 'text-foreground',
                inRange && 'rounded-none bg-primary/15 text-foreground',
                (isCheckIn || isCheckOut) && 'bg-primary font-bold text-primary-foreground',
                isCheckIn && checkOut && 'rounded-r-none',
                isCheckOut && checkIn && 'rounded-l-none',
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
        <span className="text-muted-foreground">
          {checkIn ? `Nhận: ${checkIn.split('-').reverse().join('/')}` : 'Chọn ngày nhận phòng'}
        </span>
        <span className="text-muted-foreground">
          {checkOut ? `Trả: ${checkOut.split('-').reverse().join('/')}` : checkIn ? 'Chọn ngày trả phòng' : ''}
        </span>
      </div>
    </div>
  )
}
