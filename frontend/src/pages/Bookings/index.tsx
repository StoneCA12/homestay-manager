import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BookingCalendar from '../../components/bookings/BookingCalendar'
import BookingDetailModal from '../../components/bookings/BookingDetailModal'
import BookingFormModal from '../../components/bookings/BookingFormModal'
import EditBookingModal from '../../components/bookings/EditBookingModal'
import PaymentModal from '../../components/bookings/PaymentModal'
import Layout from '../../components/layout/Layout'
import { bookingsApi, roomsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { Booking, CalendarBooking, Room } from '../../types'
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

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

const TODAY_ISO = toISO(new Date())

function isOverdueUnpaid(b: {
  status: string; check_in_date: string; total_price: string; collected_amount: string
}): boolean {
  return (
    b.status === 'CONFIRMED' &&
    b.check_in_date <= TODAY_ISO &&
    Number(b.collected_amount) < Number(b.total_price)
  )
}

interface DialogState {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  confirmDanger?: boolean
  onConfirm: () => void
}

function InlineDialog({ dialog, onCancel }: { dialog: DialogState; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-6">
          <h3 className="text-base font-bold text-slate-800 mb-2">{dialog.title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{dialog.message}</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {dialog.cancelLabel}
          </button>
          <button
            onClick={dialog.onConfirm}
            className={`flex-1 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors ${
              dialog.confirmDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionsMenu({
  isOpen, onToggle, onClose, items,
}: {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  items: Array<{ label: string; onClick: () => void; danger?: boolean }>
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        title="Thêm thao tác"
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 text-slate-400 text-sm tracking-widest"
      >
        &bull;&bull;&bull;
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg min-w-40 py-1.5">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { onClose(); item.onClick() }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${
                item.danger ? 'text-red-600 font-medium' : 'text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BookingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [calendarBookings, setCalendarBookings] = useState<CalendarBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('today')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Booking | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<Booking | null>(null)
  const [actioning, setActioning] = useState<number | null>(null)
  const [monthStart, setMonthStart] = useState<Date>(firstOfMonth(new Date()))
  const [yearStart, setYearStart] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [yearBookings, setYearBookings] = useState<CalendarBooking[]>([])
  const [search, setSearch] = useState('')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (user?.role !== 'RECEPTIONIST') {
      localStorage.setItem(OTA_BANNER_KEY, String(Date.now()))
    }
  }, [user])

  const loadBookings = (view: Tab, q?: string) => {
    if (view === 'calendar') return
    setLoading(true)
    const req = view === 'today'
      ? bookingsApi.today()
      : bookingsApi.list({ search: q || undefined })
    req.then(setBookings).catch(() => {}).finally(() => setLoading(false))
  }

  const loadCalendar = (ms: Date) => {
    const start = toISO(ms)
    const end = toISO(new Date(ms.getFullYear(), ms.getMonth() + 1, 1))
    bookingsApi.calendar(start, end).then(setCalendarBookings).catch(() => {})
  }

  const loadYearCalendar = (ys: Date) => {
    const start = toISO(ys)
    const end = toISO(new Date(ys.getFullYear() + 1, 0, 1))
    bookingsApi.calendar(start, end).then(setYearBookings).catch(() => {})
  }

  useEffect(() => {
    loadBookings(tab)
    roomsApi.list().then(setRooms).catch(() => {})
  }, [])

  const switchTab = (newTab: Tab) => {
    setTab(newTab)
    if (newTab === 'calendar') {
      loadCalendar(monthStart)
      loadYearCalendar(yearStart)
    } else {
      loadBookings(newTab, newTab === 'all' ? search : undefined)
    }
  }

  const prevYear = () => {
    const ys = new Date(yearStart.getFullYear() - 1, 0, 1)
    setYearStart(ys)
    loadYearCalendar(ys)
  }

  const nextYear = () => {
    const ys = new Date(yearStart.getFullYear() + 1, 0, 1)
    setYearStart(ys)
    loadYearCalendar(ys)
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    if (tab === 'all') loadBookings('all', q)
  }

  const handleBookingCreated = (booking: Booking) => {
    setBookings((prev) => [booking, ...prev])
    setShowForm(false)
    if (tab === 'calendar') loadCalendar(monthStart)
    showToast(t('bookings.toast.bookingCreated'))
  }

  const handleBookingSaved = (updated: Booking) => {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b))
    setEditTarget(null)
    if (tab === 'calendar') loadCalendar(monthStart)
    showToast(t('bookings.toast.bookingSaved'))
  }

  const doAction = async (booking: Booking, action: string) => {
    setActioning(booking.id)
    try {
      const updated = await bookingsApi.updateStatus(booking.id, action)
      setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b))
      if (tab === 'calendar') loadCalendar(monthStart)
      const successMsgs: Record<string, string> = {
        check_in:  t('bookings.toast.checkInSuccess'),
        check_out: t('bookings.toast.checkOutSuccess'),
        cancel:    t('bookings.toast.cancelSuccess'),
        no_show:   t('bookings.toast.noShowSuccess'),
      }
      showToast(successMsgs[action] ?? t('bookings.toast.bookingSaved'))
    } catch (err: any) {
      showToast(err?.response?.data?.detail ?? t('bookings.toast.actionFailed'), 'error')
    } finally {
      setActioning(null)
    }
  }

  const handleAction = (booking: Booking, action: string) => {
    if (action === 'check_in' && !booking.room_id) {
      setDialog({
        title: t('bookings.dialog.noRoomTitle'),
        message: t('bookings.dialog.noRoomMessage'),
        confirmLabel: t('bookings.dialog.noRoomConfirm'),
        cancelLabel: t('common.close'),
        onConfirm: () => { setDialog(null); setEditTarget(booking) },
      })
      return
    }
    if (action === 'cancel') {
      setDialog({
        title: t('bookings.dialog.cancelTitle'),
        message: t('bookings.dialog.cancelMessage', {
          guest: booking.guest_name,
          room: booking.room_number ?? '?',
        }),
        confirmLabel: t('bookings.dialog.cancelConfirm'),
        cancelLabel: t('bookings.dialog.cancelDismiss'),
        confirmDanger: true,
        onConfirm: () => { setDialog(null); doAction(booking, 'cancel') },
      })
      return
    }
    doAction(booking, action)
  }

  const handlePaymentUpdated = (updated: Booking) => {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b))
    setPaymentTarget(null)
    showToast(t('bookings.toast.paymentSaved'))
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
      <div className="p-4 md:p-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('bookings.title')}</h1>
            {tab !== 'calendar' && (
              <p className="text-sm text-slate-500 mt-1">{t('bookings.count', { count: bookings.length })}</p>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {t('bookings.newBooking')}
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {(['today', 'all', 'calendar'] as Tab[]).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => switchTab(tabKey)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  tab === tabKey ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tabKey === 'today'
                  ? t('bookings.tabs.today')
                  : tabKey === 'all'
                  ? t('bookings.tabs.all')
                  : t('bookings.tabs.calendar')}
              </button>
            ))}
          </div>

          {tab === 'all' && (
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Tìm theo tên khách..."
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          )}
        </div>

        {tab === 'calendar' && (
          <BookingCalendar
            rooms={rooms}
            bookings={calendarBookings}
            monthStart={monthStart}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            yearBookings={yearBookings}
            yearStart={yearStart}
            onPrevYear={prevYear}
            onNextYear={nextYear}
          />
        )}

        {tab !== 'calendar' && (
          loading ? (
            <p className="text-slate-500 text-sm">{t('bookings.loading')}</p>
          ) : bookings.length === 0 ? (
            <p className="text-slate-400 text-sm">{t('bookings.noBookings')}</p>
          ) : (
            <><div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    {[
                      t('bookings.table.room'),
                      t('bookings.table.guest'),
                      t('bookings.table.checkIn'),
                      t('bookings.table.checkOut'),
                      t('bookings.table.ota'),
                      t('bookings.table.status'),
                      t('bookings.table.total'),
                      t('bookings.table.collected'),
                      t('bookings.table.actions'),
                    ].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bookings.map((b) => {
                    const busy = actioning === b.id
                    const outstanding = Number(b.total_price) - Number(b.collected_amount)
                    const isEditable = b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'
                    const canPay = b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT'
                    const overdueUnpaid = isOverdueUnpaid(b)
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setDetailBooking(b)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${overdueUnpaid ? 'bg-red-50/40' : ''}`}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {b.room_number ?? (
                            <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded-full">
                              {t('bookings.noRoom')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{b.guest_name}</div>
                          {b.guest_phone && (
                            <div className="text-xs text-slate-400 mt-0.5">{b.guest_phone}</div>
                          )}
                          {overdueUnpaid && (
                            <div className="text-xs text-red-600 font-semibold mt-0.5 flex items-center gap-1">
                              <span>&#9888;</span>
                              <span>{t('bookings.unpaidOverdue')}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(b.check_in_date)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(b.check_out_date)}</td>
                        <td className="px-4 py-3 text-slate-500">{t(`ota.${b.ota_source}` as any)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {t(`status.${b.status}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{formatVND(b.total_price)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {outstanding > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-xs bg-red-50 px-2 py-1 rounded-full">
                              Còn {formatVND(outstanding)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs bg-green-50 px-2 py-1 rounded-full">
                              ✓ {t('bookings.paid')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {b.status === 'CONFIRMED' && (
                              <button
                                disabled={busy}
                                onClick={() => handleAction(b, 'check_in')}
                                className={`text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 whitespace-nowrap ${
                                  b.room_id
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-orange-400 text-white hover:bg-orange-500'
                                }`}
                              >
                                {busy ? '...' : t('bookings.actions.checkIn')}
                              </button>
                            )}
                            {b.status === 'CHECKED_IN' && (
                              <button
                                disabled={busy}
                                onClick={() => handleAction(b, 'check_out')}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
                              >
                                {busy ? '...' : t('bookings.actions.checkOut')}
                              </button>
                            )}
                            {isEditable && (
                              <button
                                onClick={() => setEditTarget(b)}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                              >
                                {t('bookings.editBooking')}
                              </button>
                            )}
                            {canPay && (
                              <button
                                onClick={() => setPaymentTarget(b)}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                              >
                                {t('bookings.actions.pay')}
                              </button>
                            )}
                            {(b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') && (
                              <ActionsMenu
                                isOpen={openMenuId === b.id}
                                onToggle={() => setOpenMenuId((id) => id === b.id ? null : b.id)}
                                onClose={() => setOpenMenuId(null)}
                                items={[
                                  ...(b.status === 'CONFIRMED' ? [{
                                    label: t('bookings.actions.noShowLabel'),
                                    onClick: () => doAction(b, 'no_show'),
                                  }] : []),
                                  {
                                    label: t('bookings.actions.cancelLabel'),
                                    onClick: () => handleAction(b, 'cancel'),
                                    danger: true,
                                  },
                                ]}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2">
              {bookings.map((b) => {
                const busy = actioning === b.id
                const outstanding = Number(b.total_price) - Number(b.collected_amount)
                const overdueUnpaid = isOverdueUnpaid(b)
                return (
                  <div
                    key={b.id}
                    onClick={() => setDetailBooking(b)}
                    className={`bg-white rounded-xl border-2 p-4 cursor-pointer active:bg-slate-50 transition-colors ${
                      overdueUnpaid ? 'border-red-200 bg-red-50/30' :
                      b.status === 'CHECKED_IN' ? 'border-green-200' :
                      b.status === 'CONFIRMED' ? 'border-blue-200' :
                      'border-gray-100'
                    }`}
                  >
                    {/* Row 1: room + status */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-base">
                        {b.room_number ? `P.${b.room_number}` : (
                          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            {t('bookings.noRoom')}
                          </span>
                        )}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t(`status.${b.status}` as any)}
                      </span>
                    </div>
                    {/* Row 2: guest */}
                    <p className="font-medium text-slate-700">{b.guest_name}</p>
                    {b.guest_phone && <p className="text-xs text-slate-400">{b.guest_phone}</p>}
                    {overdueUnpaid && (
                      <p className="text-xs text-red-600 font-semibold mt-0.5">⚠ {t('bookings.unpaidOverdue')}</p>
                    )}
                    {/* Row 3: dates */}
                    <p className="text-xs text-slate-500 mt-1.5">
                      {formatDate(b.check_in_date)} → {formatDate(b.check_out_date)}
                      <span className="ml-2 text-slate-400">{t(`ota.${b.ota_source}` as any)}</span>
                    </p>
                    {/* Row 4: payment + action */}
                    <div className="flex items-center justify-between mt-2.5" onClick={(e) => e.stopPropagation()}>
                      <span>
                        {outstanding > 0 ? (
                          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            Còn {formatVND(outstanding)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            ✓ {t('bookings.paid')}
                          </span>
                        )}
                      </span>
                      {b.status === 'CONFIRMED' && (
                        <button
                          disabled={busy}
                          onClick={() => handleAction(b, 'check_in')}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 ${
                            b.room_id ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'
                          }`}
                        >
                          {busy ? '...' : t('bookings.actions.checkIn')}
                        </button>
                      )}
                      {b.status === 'CHECKED_IN' && (
                        <button
                          disabled={busy}
                          onClick={() => handleAction(b, 'check_out')}
                          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-blue-500 text-white disabled:opacity-50"
                        >
                          {busy ? '...' : t('bookings.actions.checkOut')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div></>
          )
        )}
      </div>

      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
          onEdit={(b) => { setDetailBooking(null); setEditTarget(b) }}
          onAction={(b, action) => { setDetailBooking(null); handleAction(b, action) }}
          onPay={(b) => { setDetailBooking(null); setPaymentTarget(b) }}
        />
      )}

      {showForm && (
        <BookingFormModal
          rooms={rooms}
          onClose={() => setShowForm(false)}
          onCreated={handleBookingCreated}
        />
      )}

      {editTarget && (
        <EditBookingModal
          booking={editTarget}
          rooms={rooms}
          onClose={() => setEditTarget(null)}
          onSaved={handleBookingSaved}
        />
      )}

      {paymentTarget && (
        <PaymentModal
          booking={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onUpdated={handlePaymentUpdated}
        />
      )}

      {dialog && (
        <InlineDialog
          dialog={dialog}
          onCancel={() => setDialog(null)}
        />
      )}
    </Layout>
  )
}
