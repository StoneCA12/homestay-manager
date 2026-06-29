import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import HousekeepingRoomCard, { STATUS_CONFIG } from '../../components/housekeeping/HousekeepingRoomCard'
import FilterBar from '../../components/filters/FilterBar'
import BookingDetailModal from '../../components/bookings/BookingDetailModal'
import BookingFormModal from '../../components/bookings/BookingFormModal'
import Layout from '../../components/layout/Layout'
import { bookingsApi, roomsApi } from '../../services/api'
import type { Booking, Room, RoomStatus } from '../../types'

const ORDER: RoomStatus[] = ['DIRTY', 'CLEANING', 'OUT_OF_ORDER', 'AVAILABLE']

function groupByStatus(rooms: Room[]): Record<RoomStatus, Room[]> {
  return ORDER.reduce<Record<RoomStatus, Room[]>>((acc, s) => {
    acc[s] = rooms.filter((r) => r.housekeeping_status === s)
    return acc
  }, { DIRTY: [], CLEANING: [], OUT_OF_ORDER: [], AVAILABLE: [] })
}

type RoomFilter = 'occupied' | 'needs_cleaning' | 'ready' | 'reserved' | 'vacant'

const ROOM_FILTER_OPTIONS: ReadonlyArray<{ value: RoomFilter; label: string }> = [
  { value: 'occupied',       label: 'Đang ở' },
  { value: 'needs_cleaning', label: 'Cần dọn' },
  { value: 'ready',          label: 'Sẵn sàng' },
  { value: 'reserved',       label: 'Đã đặt' },
  { value: 'vacant',         label: 'Trống' },
] as const

function matchesRoomFilter(r: Room, f: RoomFilter): boolean {
  switch (f) {
    case 'occupied':       return r.display_status === 'OCCUPIED' || r.display_status === 'CHECKOUT_TODAY'
    case 'needs_cleaning': return r.housekeeping_status === 'DIRTY' || r.housekeeping_status === 'CLEANING'
    case 'ready':          return r.housekeeping_status === 'AVAILABLE'
    case 'reserved':       return r.display_status === 'ARRIVAL_TODAY'
    case 'vacant':         return r.display_status === 'AVAILABLE'
  }
}

export default function HousekeepingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const [error, setError] = useState('')

  // ── Modal state ──────────────────────────────────────────────────
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [assignRoom, setAssignRoom] = useState<Room | null>(null)

  // ── Filter state (URL-persisted) ─────────────────────────────────
  const activeFilters = useMemo((): ReadonlySet<RoomFilter> => {
    const raw = searchParams.get('filters') ?? ''
    return new Set(raw.split(',').filter((v): v is RoomFilter =>
      ROOM_FILTER_OPTIONS.some((o) => o.value === v),
    ))
  }, [searchParams])

  const toggleFilter = useCallback((filter: string) => {
    setSearchParams((prev) => {
      const cur = new Set(prev.get('filters')?.split(',').filter(Boolean) ?? [])
      if (cur.has(filter)) cur.delete(filter)
      else cur.add(filter)
      const next = new URLSearchParams(prev)
      if (cur.size === 0) next.delete('filters')
      else next.set('filters', [...cur].join(','))
      return next
    }, { replace: true })
  }, [setSearchParams])

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('filters')
      return next
    }, { replace: true })
  }, [setSearchParams])

  // ── Data loading + 60s polling ───────────────────────────────────
  const refresh = useCallback(() => {
    roomsApi.list().then(setRooms).catch(() => {})
  }, [])

  useEffect(() => {
    roomsApi.list()
      .then(setRooms)
      .catch(() => setError('Không thể tải danh sách phòng.'))
      .finally(() => setLoading(false))

    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  // ── Actions ──────────────────────────────────────────────────────
  const handleStatusChange = async (room: Room, next: RoomStatus) => {
    setUpdating(room.id)
    try {
      await roomsApi.updateStatus(room.id, next)
      setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, housekeeping_status: next } : r))
    } catch {
      setError('Không thể cập nhật trạng thái.')
    } finally {
      setUpdating(null)
    }
  }

  const handleViewBooking = async (bookingId: number) => {
    try {
      const booking = await bookingsApi.getById(bookingId)
      setDetailBooking(booking)
    } catch {
      setError('Không thể tải thông tin đặt phòng.')
    }
  }

  // ── Derived data ─────────────────────────────────────────────────
  const grouped = groupByStatus(rooms)

  const filterCounts = useMemo(
    () => Object.fromEntries(
      ROOM_FILTER_OPTIONS.map((opt) => [opt.value, rooms.filter((r) => matchesRoomFilter(r, opt.value)).length]),
    ) as Record<RoomFilter, number>,
    [rooms],
  )

  const displayedRooms = useMemo(
    () => activeFilters.size === 0
      ? rooms
      : rooms.filter((r) => [...activeFilters].every((f) => matchesRoomFilter(r, f))),
    [rooms, activeFilters],
  )

  const displayedGrouped = groupByStatus(displayedRooms)

  const roomFilterOptions = ROOM_FILTER_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    count: filterCounts[opt.value],
  }))

  return (
    <Layout>
      <div className="mx-auto max-w-6xl p-4 md:p-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('housekeeping.title')}</h1>
          {activeFilters.size > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {displayedRooms.length} / {rooms.length} phòng
            </p>
          )}
        </div>

        {/* ── Summary cards (always shows full counts) ── */}
        <div className="mb-4 flex flex-wrap gap-3">
          {ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s]
            return (
              <div key={s} className={`rounded-xl border px-5 py-3 ${cfg.bg} ${cfg.border}`}>
                <p className="text-2xl font-bold text-foreground">{grouped[s].length}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t(`roomStatus.${s}` as any)}</p>
              </div>
            )
          })}
        </div>

        {/* ── Filter bar ── */}
        <div className="mb-6">
          <FilterBar
            options={roomFilterOptions}
            active={activeFilters}
            onToggle={toggleFilter}
            onClear={clearFilters}
          />
        </div>

        {/* ── Loading / error ── */}
        {loading && <p className="text-muted-foreground">{t('bookings.loading')}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && displayedRooms.length === 0 && rooms.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Không có phòng nào khớp với bộ lọc.{' '}
            <button className="underline" onClick={clearFilters}>Xóa bộ lọc</button>
          </p>
        )}

        {/* ── Kanban groups ── */}
        {!loading && ORDER.filter((s) => displayedGrouped[s].length > 0).map((s) => (
          <div key={s} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`roomStatus.${s}` as any)} ({displayedGrouped[s].length})
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {displayedGrouped[s].map((room) => (
                <HousekeepingRoomCard
                  key={room.id}
                  room={room}
                  updating={updating === room.id}
                  onStatusChange={handleStatusChange}
                  onViewBooking={handleViewBooking}
                  onAssignGuest={setAssignRoom}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Booking detail modal ── */}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          rooms={rooms}
          onClose={() => setDetailBooking(null)}
          onEdit={() => setDetailBooking(null)}
          onAction={(_b, _action) => setDetailBooking(null)}
          onPay={() => setDetailBooking(null)}
          onStatusChanged={(updated) => {
            setRooms((prev) => prev.map((r) =>
              r.active_booking_id === updated.id ? { ...r, guest_name: updated.guest_name } : r,
            ))
            setDetailBooking(null)
          }}
        />
      )}

      {/* ── New booking modal (pre-filled with room) ── */}
      {assignRoom && (
        <BookingFormModal
          rooms={rooms}
          defaultRoomId={assignRoom.id}
          onClose={() => setAssignRoom(null)}
          onCreated={() => {
            setAssignRoom(null)
            refresh()
          }}
        />
      )}
    </Layout>
  )
}
