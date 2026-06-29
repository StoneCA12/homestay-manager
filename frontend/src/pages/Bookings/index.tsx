import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, MoreHorizontal, Plus, Search } from 'lucide-react'
import BookingCalendar from '../../components/bookings/BookingCalendar'
import BookingDetailModal from '../../components/bookings/BookingDetailModal'
import BookingFormModal from '../../components/bookings/BookingFormModal'
import BookingStatusBadge from '../../components/bookings/BookingStatusBadge'
import EditBookingModal from '../../components/bookings/EditBookingModal'
import PaymentModal from '../../components/bookings/PaymentModal'
import UndoToast, { type UndoAction } from '../../components/bookings/UndoToast'
import CheckInWizard from '../../components/checkin/CheckInWizard'
import WalkInWizard from '../../components/walkin/WalkInWizard'
import Layout from '../../components/layout/Layout'
import { bookingsApi, roomsApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { Booking, CalendarBooking, Room } from '../../types'
import { formatDate, formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const OTA_BANNER_KEY = 'lastBookingsVisit'
const PAGE_SIZE = 50

type Tab = 'today' | 'all' | 'archived' | 'calendar'

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

function ConfirmDialog({ dialog, onCancel }: { dialog: DialogState; onCancel: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-sm" showClose={false}>
        <DialogHeader>
          <DialogTitle>{dialog.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{dialog.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onCancel}>
            {dialog.cancelLabel}
          </Button>
          <Button
            size="lg"
            variant={dialog.confirmDanger ? 'destructive' : 'default'}
            onClick={dialog.onConfirm}
          >
            {dialog.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PaymentCell({ outstanding }: { outstanding: number }) {
  const { t } = useTranslation()
  return outstanding > 0 ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
      Còn {formatVND(outstanding)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
      <Check className="h-3 w-3" /> {t('bookings.paid')}
    </span>
  )
}

export default function BookingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [calendarBookings, setCalendarBookings] = useState<CalendarBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [tab, setTab] = useState<Tab>('today')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Booking | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<Booking | null>(null)
  const [actioning, setActioning] = useState<number | null>(null)
  const [monthStart, setMonthStart] = useState<Date>(firstOfMonth(new Date()))
  const [yearStart, setYearStart] = useState<Date>(new Date(new Date().getFullYear(), 0, 1))
  const [yearBookings, setYearBookings] = useState<CalendarBooking[]>([])
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const [checkInTarget, setCheckInTarget] = useState<Booking | null>(null)
  const [showWalkIn, setShowWalkIn] = useState(false)

  useEffect(() => {
    if (user?.role !== 'RECEPTIONIST') {
      localStorage.setItem(OTA_BANNER_KEY, String(Date.now()))
    }
  }, [user])

  // Deep-link: open a specific booking detail, or switch to a tab via FAB navigation.
  useEffect(() => {
    const state = location.state as { openBookingId?: number; fabTab?: string } | null
    if (!state) return

    if (state.openBookingId) {
      bookingsApi.getById(state.openBookingId).then(setDetailBooking).catch(() => {})
    }

    if (state.fabTab) {
      const target = state.fabTab as Tab
      setTab(target)
      loadBookings(target)
    }

    // Clear so back-navigation doesn't re-trigger.
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadBookings = (view: Tab, q?: string) => {
    if (view === 'calendar') return
    setLoading(true)
    setHasMore(false)
    const req = view === 'today'
      ? bookingsApi.today()
      : bookingsApi.list({
          search: view === 'all' ? (q || undefined) : undefined,
          archived: view === 'archived',
          limit: PAGE_SIZE,
          offset: 0,
        })
    req
      .then((rows) => {
        setBookings(rows)
        if (view === 'all' || view === 'archived') setHasMore(rows.length === PAGE_SIZE)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadMore = () => {
    setLoadingMore(true)
    bookingsApi
      .list({
        search: tab === 'all' ? (search || undefined) : undefined,
        archived: tab === 'archived',
        limit: PAGE_SIZE,
        offset: bookings.length,
      })
      .then((rows) => {
        setBookings((prev) => [...prev, ...rows])
        setHasMore(rows.length === PAGE_SIZE)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (tab === 'all' || tab === 'archived') loadBookings(tab, q)
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
    if (action === 'check_in') {
      setDetailBooking(null)
      setCheckInTarget(booking)
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

  const handleStatusChanged = (updated: Booking) => {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b))
    setDetailBooking(updated)
    if (tab === 'calendar') loadCalendar(monthStart)
    if (updated.status === 'CANCELLED') {
      setUndoAction({
        label: `Đã hủy đặt phòng #${updated.id} — ${updated.guest_name}`,
        onUndo: async () => {
          const restored = await bookingsApi.restore(updated.id)
          setBookings((prev) => prev.map((b) => b.id === restored.id ? restored : b))
          setDetailBooking(restored)
        },
      })
    }
  }

  const handleArchived = (updated: Booking) => {
    setBookings((prev) => prev.filter((b) => b.id !== updated.id))
    setDetailBooking(null)
    setUndoAction({
      label: `Đã lưu trữ đặt phòng #${updated.id} — ${updated.guest_name}`,
      onUndo: async () => {
        const restored = await bookingsApi.restore(updated.id)
        if (tab !== 'archived') setBookings((prev) => [restored, ...prev])
        setDetailBooking(restored)
      },
    })
  }

  const handleRestored = (updated: Booking) => {
    if (tab === 'archived') {
      setBookings((prev) => prev.filter((b) => b.id !== updated.id))
    } else {
      setBookings((prev) => [updated, ...prev.filter((b) => b.id !== updated.id)])
    }
    setDetailBooking(updated)
    setUndoAction({
      label: `Đã khôi phục đặt phòng #${updated.id} — ${updated.guest_name}`,
      onUndo: async () => {
        const archived = await bookingsApi.archive(updated.id)
        setBookings((prev) => prev.filter((b) => b.id !== archived.id))
        setDetailBooking(null)
      },
    })
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

  // Builds the overflow ("...") menu items for a booking, shared by table + mobile.
  const menuItems = (b: Booking) => {
    const isEditable = b.status === 'CONFIRMED' || b.status === 'CHECKED_IN'
    const canPay = b.status === 'CONFIRMED' || b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT'
    const items: Array<{ label: string; onClick: () => void; danger?: boolean }> = []
    if (isEditable) items.push({ label: t('bookings.editBooking'), onClick: () => setEditTarget(b) })
    if (canPay) items.push({ label: t('bookings.actions.pay'), onClick: () => setPaymentTarget(b) })
    if (b.status === 'CONFIRMED') items.push({ label: t('bookings.actions.noShowLabel'), onClick: () => doAction(b, 'no_show') })
    if (b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') {
      items.push({ label: t('bookings.actions.cancelLabel'), onClick: () => handleAction(b, 'cancel'), danger: true })
    }
    return items
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('bookings.title')}</h1>
            {tab !== 'calendar' && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('bookings.count', { count: bookings.length })}{tab === 'all' && hasMore ? '+' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowWalkIn(true)}>
              Walk-in
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              {t('bookings.newBooking')}
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1">
            {(['today', 'all', 'archived', 'calendar'] as Tab[]).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => switchTab(tabKey)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  tab === tabKey
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tabKey === 'today'
                  ? t('bookings.tabs.today')
                  : tabKey === 'all'
                  ? t('bookings.tabs.all')
                  : tabKey === 'archived'
                  ? 'Lưu trữ'
                  : t('bookings.tabs.calendar')}
              </button>
            ))}
          </div>

          {(tab === 'all' || tab === 'archived') && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Tìm theo tên khách..."
                className="h-9 pl-8"
              />
            </div>
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
            <p className="text-sm text-muted-foreground">{t('bookings.loading')}</p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('bookings.noBookings')}</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
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
                        <TableHead key={h} className="whitespace-nowrap uppercase tracking-wide">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((b) => {
                      const busy = actioning === b.id
                      const outstanding = Number(b.total_price) - Number(b.collected_amount)
                      const overdueUnpaid = isOverdueUnpaid(b)
                      return (
                        <TableRow
                          key={b.id}
                          onClick={() => setDetailBooking(b)}
                          className={cn('cursor-pointer', overdueUnpaid && 'bg-red-50/40')}
                        >
                          <TableCell className="font-semibold text-foreground">
                            {b.room_number ?? (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                                {t('bookings.noRoom')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{b.guest_name}</div>
                            {b.guest_phone && (
                              <div className="mt-0.5 text-xs text-muted-foreground">{b.guest_phone}</div>
                            )}
                            {overdueUnpaid && (
                              <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-red-600">
                                <AlertTriangle className="h-3 w-3" />
                                <span>{t('bookings.unpaidOverdue')}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(b.check_in_date)}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(b.check_out_date)}</TableCell>
                          <TableCell className="text-muted-foreground">{t(`ota.${b.ota_source}` as any)}</TableCell>
                          <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                          <TableCell className="whitespace-nowrap font-medium text-foreground">{formatVND(b.total_price)}</TableCell>
                          <TableCell className="whitespace-nowrap"><PaymentCell outstanding={outstanding} /></TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              {b.status === 'CONFIRMED' && (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => handleAction(b, 'check_in')}
                                  className={cn(
                                    'whitespace-nowrap text-white',
                                    b.room_id
                                      ? 'bg-emerald-500 hover:bg-emerald-600'
                                      : 'bg-orange-400 hover:bg-orange-500'
                                  )}
                                >
                                  {busy ? '...' : t('bookings.actions.checkIn')}
                                </Button>
                              )}
                              {b.status === 'CHECKED_IN' && (
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => handleAction(b, 'check_out')}
                                  className="whitespace-nowrap bg-blue-500 text-white hover:bg-blue-600"
                                >
                                  {busy ? '...' : t('bookings.actions.checkOut')}
                                </Button>
                              )}
                              {menuItems(b).length > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" aria-label={t('bookings.table.actions')}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {menuItems(b).map((item, i) => (
                                      <DropdownMenuItem
                                        key={i}
                                        variant={item.danger ? 'destructive' : 'default'}
                                        onClick={item.onClick}
                                      >
                                        {item.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list */}
              <div className="space-y-2 md:hidden">
                {bookings.map((b) => {
                  const busy = actioning === b.id
                  const outstanding = Number(b.total_price) - Number(b.collected_amount)
                  const overdueUnpaid = isOverdueUnpaid(b)
                  return (
                    <div
                      key={b.id}
                      onClick={() => setDetailBooking(b)}
                      className={cn(
                        'cursor-pointer rounded-xl border-2 bg-card p-4 transition-colors active:bg-muted/50',
                        overdueUnpaid
                          ? 'border-red-200 bg-red-50/30'
                          : b.status === 'CHECKED_IN'
                          ? 'border-emerald-200'
                          : b.status === 'CONFIRMED'
                          ? 'border-blue-200'
                          : 'border-border'
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-base font-bold text-foreground">
                          {b.room_number ? `P.${b.room_number}` : (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">
                              {t('bookings.noRoom')}
                            </span>
                          )}
                        </span>
                        <BookingStatusBadge status={b.status} />
                      </div>
                      <p className="font-medium text-foreground">{b.guest_name}</p>
                      {b.guest_phone && <p className="text-xs text-muted-foreground">{b.guest_phone}</p>}
                      {overdueUnpaid && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-red-600">
                          <AlertTriangle className="h-3 w-3" /> {t('bookings.unpaidOverdue')}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {formatDate(b.check_in_date)} → {formatDate(b.check_out_date)}
                        <span className="ml-2 text-muted-foreground/70">{t(`ota.${b.ota_source}` as any)}</span>
                      </p>
                      <div className="mt-2.5 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                        <PaymentCell outstanding={outstanding} />
                        <div className="flex items-center gap-2">
                          {b.status === 'CONFIRMED' && (
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => handleAction(b, 'check_in')}
                              className={cn('text-white', b.room_id ? 'bg-emerald-500' : 'bg-orange-400')}
                            >
                              {busy ? '...' : t('bookings.actions.checkIn')}
                            </Button>
                          )}
                          {b.status === 'CHECKED_IN' && (
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => handleAction(b, 'check_out')}
                              className="bg-blue-500 text-white"
                            >
                              {busy ? '...' : t('bookings.actions.checkOut')}
                            </Button>
                          )}
                          {menuItems(b).length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon-sm" aria-label={t('bookings.table.actions')}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {menuItems(b).map((item, i) => (
                                  <DropdownMenuItem
                                    key={i}
                                    variant={item.danger ? 'destructive' : 'default'}
                                    onClick={item.onClick}
                                  >
                                    {item.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {(tab === 'all' || tab === 'archived') && hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? t('bookings.loading') : t('bookings.loadMore')}
                  </Button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          rooms={rooms}
          onClose={() => setDetailBooking(null)}
          onEdit={(b) => { setDetailBooking(null); setEditTarget(b) }}
          onAction={(b, action) => { setDetailBooking(null); handleAction(b, action) }}
          onPay={(b) => { setDetailBooking(null); setPaymentTarget(b) }}
          onStatusChanged={handleStatusChanged}
          onArchived={handleArchived}
          onRestored={handleRestored}
        />
      )}

      {undoAction && (
        <UndoToast
          action={undoAction}
          onDismiss={() => setUndoAction(null)}
        />
      )}

      {showWalkIn && (
        <WalkInWizard
          onComplete={(booking) => {
            setBookings((prev) => [booking, ...prev])
            setShowWalkIn(false)
            if (tab === 'calendar') loadCalendar(monthStart)
            showToast('Nhận phòng walk-in thành công')
          }}
          onClose={() => setShowWalkIn(false)}
        />
      )}

      {checkInTarget && (
        <CheckInWizard
          booking={checkInTarget}
          rooms={rooms}
          onComplete={(updated) => {
            setBookings((prev) => prev.map((b) => b.id === updated.id ? updated : b))
            setCheckInTarget(null)
            if (tab === 'calendar') loadCalendar(monthStart)
            showToast(t('bookings.toast.checkInSuccess'))
          }}
          onClose={() => setCheckInTarget(null)}
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
        <ConfirmDialog
          dialog={dialog}
          onCancel={() => setDialog(null)}
        />
      )}
    </Layout>
  )
}
