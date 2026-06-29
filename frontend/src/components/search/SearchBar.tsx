import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BedDouble, Bike, CalendarDays, Loader2, Search, User2, X } from 'lucide-react'
import { searchApi } from '../../services/api'
import type { SearchResults } from '../../types'
import { cn } from '@/lib/utils'

// ── Vietnamese display labels ────────────────────────────────────

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ', CONFIRMED: 'Đã đặt', CHECKED_IN: 'Đang ở',
  CHECKED_OUT: 'Đã trả', CANCELLED: 'Hủy', NO_SHOW: 'Không đến',
}
const BOOKING_STATUS_COLOR: Record<string, string> = {
  PENDING:     'bg-amber-100 text-amber-700',
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-slate-100 text-slate-600',
  CANCELLED:   'bg-red-100 text-red-700',
  NO_SHOW:     'bg-orange-100 text-orange-700',
}
const ROOM_TYPE_LABEL: Record<string, string> = {
  FAMILY: 'Gia đình', WINDOW: 'Cửa sổ', BALCONY: 'Ban công', REGULAR: 'Thường',
}
const HSTATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng', DIRTY: 'Cần dọn', CLEANING: 'Đang dọn', OUT_OF_ORDER: 'Bảo trì',
}
const BIKE_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Sẵn sàng', RENTED: 'Đang thuê', MAINTENANCE: 'Bảo trì',
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
}

// ── Module-level sub-components (prevent React identity issues) ──

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {title}
    </p>
  )
}

function ResultRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

function IconDot({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', bg)}>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function SearchBar() {
  const navigate = useNavigate()
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResults | null>(null)
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  // ── Debounced search ──
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults(null)
      setOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchApi.search(term)
        setResults(data)
        setOpen(true)
      } catch {
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // ── Close on click outside ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults(null)
  }, [])

  // Navigate handlers — each closes search after navigation
  const goBooking = useCallback((id: number) => {
    navigate('/bookings', { state: { openBookingId: id } })
    close()
  }, [navigate, close])

  const goGuest = useCallback((phone: string | null, name: string) => {
    navigate('/bookings', { state: { search: phone ?? name } })
    close()
  }, [navigate, close])

  const goRoom = useCallback(() => {
    navigate('/housekeeping')
    close()
  }, [navigate, close])

  const goBike = useCallback(() => {
    navigate('/xe-may')
    close()
  }, [navigate, close])

  const total = results
    ? results.guests.length + results.bookings.length + results.rooms.length + results.bikes.length
    : 0

  return (
    <div ref={containerRef} className="relative w-full">

      {/* ── Input ── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') close() }}
          onFocus={() => { if (results && total > 0) setOpen(true) }}
          placeholder="Tìm khách, phòng, xe máy..."
          className={cn(
            'h-9 w-full rounded-xl border bg-muted/40 pl-9 pr-8 text-sm',
            'placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            'transition-colors',
          )}
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            onClick={close}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Xóa tìm kiếm"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* ── Dropdown ── */}
      {open && results && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border bg-popover shadow-xl">
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả cho "{query.trim()}"
            </p>
          ) : (
            <div className="max-h-[480px] overflow-y-auto">

              {/* Guests */}
              {results.guests.length > 0 && (
                <section>
                  <SectionHeader title={`Khách (${results.guests.length})`} />
                  {results.guests.map((g) => (
                    <ResultRow key={g.id} onClick={() => goGuest(g.phone, g.full_name)}>
                      <IconDot bg="bg-blue-100">
                        <User2 className="h-3.5 w-3.5 text-blue-600" />
                      </IconDot>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{g.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.phone ?? 'Không có SĐT'}&nbsp;·&nbsp;{g.times_stayed} lần ở
                        </p>
                      </div>
                    </ResultRow>
                  ))}
                </section>
              )}

              {/* Bookings */}
              {results.bookings.length > 0 && (
                <section className={results.guests.length > 0 ? 'border-t border-border/50' : ''}>
                  <SectionHeader title={`Đặt phòng (${results.bookings.length})`} />
                  {results.bookings.map((b) => (
                    <ResultRow key={b.id} onClick={() => goBooking(b.id)}>
                      <IconDot bg="bg-emerald-100">
                        <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                      </IconDot>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-foreground">{b.guest_name}</p>
                          <span className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
                            BOOKING_STATUS_COLOR[b.status] ?? 'bg-muted text-muted-foreground',
                          )}>
                            {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {b.room_number ? `P.${b.room_number} · ` : ''}
                          {fmtDate(b.check_in_date)} → {fmtDate(b.check_out_date)}
                          {b.booking_ref ? ` · ${b.booking_ref}` : ''}
                        </p>
                      </div>
                    </ResultRow>
                  ))}
                </section>
              )}

              {/* Rooms */}
              {results.rooms.length > 0 && (
                <section className={
                  results.guests.length + results.bookings.length > 0 ? 'border-t border-border/50' : ''
                }>
                  <SectionHeader title={`Phòng (${results.rooms.length})`} />
                  {results.rooms.map((r) => (
                    <ResultRow key={r.id} onClick={goRoom}>
                      <IconDot bg="bg-amber-100">
                        <BedDouble className="h-3.5 w-3.5 text-amber-600" />
                      </IconDot>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Phòng {r.room_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROOM_TYPE_LABEL[r.room_type] ?? r.room_type}&nbsp;·&nbsp;
                          {HSTATUS_LABEL[r.housekeeping_status] ?? r.housekeeping_status}
                        </p>
                      </div>
                    </ResultRow>
                  ))}
                </section>
              )}

              {/* Bikes */}
              {results.bikes.length > 0 && (
                <section className={total - results.bikes.length > 0 ? 'border-t border-border/50' : ''}>
                  <SectionHeader title={`Xe máy (${results.bikes.length})`} />
                  {results.bikes.map((b) => (
                    <ResultRow key={b.id} onClick={goBike}>
                      <IconDot bg="bg-purple-100">
                        <Bike className="h-3.5 w-3.5 text-purple-600" />
                      </IconDot>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.plate_number ? `${b.plate_number} · ` : ''}
                          {BIKE_STATUS_LABEL[b.status] ?? b.status}
                        </p>
                      </div>
                    </ResultRow>
                  ))}
                </section>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}
