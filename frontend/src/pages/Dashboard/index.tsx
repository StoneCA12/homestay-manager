import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/layout/Layout'
import RoomCard from '../../components/rooms/RoomCard'
import { roomsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { DashboardStats, Room } from '../../types'

const OTA_BANNER_KEY = 'lastBookingsVisit'

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [otaHours, setOtaHours] = useState<number | null>(null)

  const STAT_CARDS = [
    { key: 'total_rooms',     label: t('dashboard.totalRooms'),     color: 'bg-slate-50  border-slate-200  text-slate-700' },
    { key: 'occupied',        label: t('dashboard.occupied'),        color: 'bg-green-50  border-green-200  text-green-700' },
    { key: 'arrivals_today',  label: t('dashboard.arrivalsToday'),   color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { key: 'checkouts_today', label: t('dashboard.checkoutsToday'),  color: 'bg-blue-50   border-blue-200   text-blue-700' },
    { key: 'available',       label: t('dashboard.available'),       color: 'bg-white     border-gray-200   text-gray-600' },
    { key: 'dirty',           label: t('dashboard.needsCleaning'),   color: 'bg-red-50    border-red-200    text-red-700' },
  ] as const

  const LEGEND = [
    { key: 'dashboard.legend.occupied',      dot: 'bg-green-500'  },
    { key: 'dashboard.legend.arrivalToday',  dot: 'bg-yellow-400' },
    { key: 'dashboard.legend.checkoutToday', dot: 'bg-blue-500'   },
    { key: 'dashboard.legend.dirty',         dot: 'bg-red-500'    },
    { key: 'dashboard.legend.cleaning',      dot: 'bg-orange-400' },
    { key: 'dashboard.legend.outOfOrder',    dot: 'bg-gray-400'   },
    { key: 'dashboard.legend.available',     dot: 'bg-gray-300'   },
  ] as const

  useEffect(() => {
    if (user?.role !== 'RECEPTIONIST') {
      const last = localStorage.getItem(OTA_BANNER_KEY)
      if (last) {
        const hours = (Date.now() - Number(last)) / 3_600_000
        if (hours >= 12) setOtaHours(Math.floor(hours))
      }
    }
  }, [user])

  useEffect(() => {
    Promise.all([roomsApi.list(), roomsApi.stats()])
      .then(([r, s]) => { setRooms(r); setStats(s) })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const handleBannerClick = () => {
    localStorage.setItem(OTA_BANNER_KEY, String(Date.now()))
    setOtaHours(null)
    navigate('/bookings')
  }

  return (
    <Layout>
      <div className="p-8 max-w-7xl">
        {/* OTA email reminder banner */}
        {otaHours !== null && (
          <button
            onClick={handleBannerClick}
            className="w-full mb-5 flex items-center gap-3 bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm font-medium px-4 py-3 rounded-xl hover:bg-yellow-100 transition-colors text-left"
          >
            <span className="text-lg">⚠️</span>
            <span>{t('dashboard.otaBanner')}</span>
          </button>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>

        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {STAT_CARDS.map(({ key, label, color }) => (
              <div key={key} className={`rounded-xl border p-4 ${color}`}>
                <p className="text-3xl font-bold">{stats[key]}</p>
                <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Status legend */}
        <div className="flex flex-wrap gap-3 mb-6">
          {LEGEND.map(({ key, dot }) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
              {t(key as any)}
            </span>
          ))}
        </div>

        {/* Room grid */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border-2 border-gray-100 bg-gray-50 h-36 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
