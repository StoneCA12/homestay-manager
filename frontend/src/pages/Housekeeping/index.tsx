import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import HousekeepingRoomCard, { STATUS_CONFIG } from '../../components/housekeeping/HousekeepingRoomCard'
import Layout from '../../components/layout/Layout'
import { roomsApi } from '../../services/api'
import type { Room, RoomStatus } from '../../types'

const ORDER: RoomStatus[] = ['DIRTY', 'CLEANING', 'OUT_OF_ORDER', 'AVAILABLE']

function groupByStatus(rooms: Room[]): Record<RoomStatus, Room[]> {
  return ORDER.reduce<Record<RoomStatus, Room[]>>((acc, s) => {
    acc[s] = rooms.filter((r) => r.housekeeping_status === s)
    return acc
  }, { DIRTY: [], CLEANING: [], OUT_OF_ORDER: [], AVAILABLE: [] })
}

export default function HousekeepingPage() {
  const { t } = useTranslation()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    roomsApi.list()
      .then(setRooms)
      .catch(() => setError('Failed to load rooms.'))
      .finally(() => setLoading(false))
  }, [])

  const handleStatusChange = async (room: Room, next: RoomStatus) => {
    setUpdating(room.id)
    try {
      await roomsApi.updateStatus(room.id, next)
      setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, housekeeping_status: next } : r))
    } catch {
      setError('Failed to update status.')
    } finally {
      setUpdating(null)
    }
  }

  const grouped = groupByStatus(rooms)

  return (
    <Layout>
      <div className="p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">{t('housekeeping.title')}</h1>
        </div>

        <div className="flex gap-3 mb-8">
          {ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s]
            return (
              <div key={s} className={`rounded-xl border px-5 py-3 ${cfg.bg} ${cfg.border}`}>
                <p className="text-2xl font-bold text-slate-800">{grouped[s].length}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t(`roomStatus.${s}` as any)}</p>
              </div>
            )
          })}
        </div>

        {loading && <p className="text-slate-500">{t('bookings.loading')}</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {!loading && ORDER.filter((s) => grouped[s].length > 0).map((s) => (
          <div key={s} className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {t(`roomStatus.${s}` as any)} ({grouped[s].length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {grouped[s].map((room) => (
                <HousekeepingRoomCard
                  key={room.id}
                  room={room}
                  updating={updating === room.id}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
