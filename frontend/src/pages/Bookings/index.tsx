import { useEffect, useState } from 'react'
import BookingCalendar from '../../components/bookings/BookingCalendar'
import BookingFormModal from '../../components/bookings/BookingFormModal'
import PaymentModal from '../../components/bookings/PaymentModal'
import Layout from '../../components/layout/Layout'
import { bookingsApi, roomsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import type { Booking, CalendarBooking, OTASource, Room } from '../../types'
import { formatDate, formatVND } from '../../utils/format'

const OTA_BANNER_KEY = 'lastBookingsVisit'

type Tab = 'today' | 'all' | 'calendar'

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
  CANCELLED:   'bg-red-100 text-red-600',
  NO_SHOW:     'bg-yellow-100 text-yellow-700',
}

const OTA_LABEL: Record<OTASource, string> = {
  AGODA: 'Agoda', BOOKING_COM: 'Booking.com', TRAVELOKA: 'Traveloka', DIRECT: 'Direct',
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function BookingsPage() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [calendarBookings, setCalendarBookings] = useState<CalendarBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('today')
  const [showForm, setShowForm] = useState(false)
  const [paymentTarget, setPaymentTarget] = useState<Booking | null>(null)
  const [actioning, setActioning] = useState<number | null>(null)
  const [monthStart, setMonthStart] = useState<Date>(firstOfMonth(new Date()))

  // Reset OTA 12h reminder timer whenever Bookings page is opened
  useEffect(() => {
    if (user?.role !== 'RECEPTIONIST') {
      localStorage.setItem(OTA_BANNER_KEY, String(Date.now()))
    }
  }, [user])

  const loadBookings = (view: Tab) => {
    if (view === 'calendar') return
    setLoading(true)
    const req = view === 'today' ? bookingsApi.today() : bookingsApi.list()
    req.then(setBookings).catch(() => {}).finally(() => setLoading(false))
  }

  const loadCalendar = (ms: Date) => {
    const start = toISO(ms)
    const end = toISO(new Date(ms.getFullYear(), ms.getMonth() + 1, 1))
    bookingsApi.calendar(start, end).then(setCalendarBookings).catch(() => {})
  }

  useEffect(() => {
    loadBookings(tab)
    roomsApi.list().then(setRooms).catch(() => {})
  }, [])

  const switchTab = (t: Tab) => {
    setTab(t)
    if (t === 'calendar') {
      loadCalendar(monthStart)
    } else {
      loadBookings(t)
    }
  }

  const handleBookingCreated = (booking: Booking) => {
    setBookings((prev) => [booking, ...prev])
    setShowForm(false)
    if (tab === 'calendar') loadCalendar(monthStart)
  }

  const handleAction = async (booking: Booking, action: string) => {
    if (action === 'cancel' && !confirm(`Cancel booking for ${booking.guest_name} in room ${booking.room_number}?`)) return
    setActioning(booking.id)
    try {
      const updated = await bookingsApi.updateStatus(booking.id, action)
      setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b))
      if (tab === 'calendar') loadCalendar(monthStart)
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Action failed.')
    } finally {
      setActioning(null)
    }
  }

  const handlePaymentUpdated = (updated: Booking) => {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b))
    setPaymentTarget(null)
  }

  const prevMonth = () => {
    const ms = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1)
    setMonthStart(ms)
    loadCalendar(ms)
  }

  const nextMonth = () => {
    const ms = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    setMonthStart(ms)
    loadCalendar(ms)
  }

  return (
    <Layout>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Bookings</h1>
            {tab !== 'calendar' && (
              <p className="text-sm text-slate-500 mt-1">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Booking
          </button>
        </div>

        <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
          {(['today', 'all', 'calendar'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'today' ? 'Today' : t === 'all' ? 'All Bookings' : 'Calendar'}
            </button>
          ))}
        </div>

        {/* Calendar tab */}
        {tab === 'calendar' && (
          <BookingCalendar
            rooms={rooms}
            bookings={calendarBookings}
            monthStart={monthStart}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        )}

        {/* List tabs */}
        {tab !== 'calendar' && (
          loading ? (
            <p className="text-slate-500 text-sm">Loading…</p>
          ) : bookings.length === 0 ? (
            <p className="text-slate-400 text-sm">No bookings found.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    {['Room', 'Guest', 'Check-in', 'Check-out', 'OTA', 'Status', 'Total', 'Collected', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((b) => {
                    const busy = actioning === b.id
                    const outstanding = Number(b.total_price) - Number(b.collected_amount)
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">{b.room_number}</td>
                        <td className="px-4 py-3 text-slate-700">{b.guest_name}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(b.check_in_date)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(b.check_out_date)}</td>
                        <td className="px-4 py-3 text-slate-500">{OTA_LABEL[b.ota_source]}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{formatVND(b.total_price)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={outstanding > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                            {outstanding > 0 ? `−${formatVND(outstanding)}` : '✓ Paid'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {b.status === 'CONFIRMED' && (
                              <button disabled={busy} onClick={() => handleAction(b, 'check_in')} className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 whitespace-nowrap">
                                {busy ? '…' : 'Check In'}
                              </button>
                            )}
                            {b.status === 'CHECKED_IN' && (
                              <button disabled={busy} onClick={() => handleAction(b, 'check_out')} className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 whitespace-nowrap">
                                {busy ? '…' : 'Check Out'}
                              </button>
                            )}
                            {(b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT') && (
                              <button onClick={() => setPaymentTarget(b)} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap">
                                Pay
                              </button>
                            )}
                            {(b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') && (
                              <button disabled={busy} onClick={() => handleAction(b, 'cancel')} className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50">
                                {busy ? '…' : '✕'}
                              </button>
                            )}
                            {b.status === 'CONFIRMED' && (
                              <button disabled={busy} onClick={() => handleAction(b, 'no_show')} className="text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-600 hover:bg-yellow-100 disabled:opacity-50 whitespace-nowrap">
                                No-show
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showForm && (
        <BookingFormModal
          rooms={rooms}
          onClose={() => setShowForm(false)}
          onCreated={handleBookingCreated}
        />
      )}

      {paymentTarget && (
        <PaymentModal
          booking={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onUpdated={handlePaymentUpdated}
        />
      )}
    </Layout>
  )
}
