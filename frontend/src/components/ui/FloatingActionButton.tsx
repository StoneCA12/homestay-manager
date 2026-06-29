import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Banknote, CalendarPlus, FileText, Hash, LogIn, LogOut, Plus, UserPlus } from 'lucide-react'
import type { Booking, Room } from '../../types'
import { roomsApi } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import { cn } from '@/lib/utils'
import BookingFormModal from '../bookings/BookingFormModal'
import WalkInWizard from '../walkin/WalkInWizard'

type ActionId = 'new-booking' | 'walk-in' | 'check-in' | 'check-out' | 'assign-room' | 'payment' | 'note'

const ACTIONS: { id: ActionId; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'new-booking', label: 'Đặt phòng mới', icon: CalendarPlus, color: 'text-blue-600' },
  { id: 'walk-in',     label: 'Walk-In',        icon: UserPlus,    color: 'text-emerald-600' },
  { id: 'check-in',    label: 'Nhận phòng',     icon: LogIn,       color: 'text-indigo-600' },
  { id: 'check-out',   label: 'Trả phòng',      icon: LogOut,      color: 'text-orange-600' },
  { id: 'assign-room', label: 'Gán phòng',      icon: Hash,        color: 'text-slate-600' },
  { id: 'payment',     label: 'Thu tiền',       icon: Banknote,    color: 'text-violet-600' },
  { id: 'note',        label: 'Thêm ghi chú',   icon: FileText,    color: 'text-stone-600' },
]

const FAB_TAB_MAP: Partial<Record<ActionId, string>> = {
  'check-in':    'today',
  'check-out':   'today',
  'assign-room': 'all',
  'payment':     'all',
  'note':        'all',
}

export default function FloatingActionButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { showToast } = useToast()

  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<'new-booking' | 'walk-in' | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close menu on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Don't show on login page — after all hooks so rules of hooks are satisfied
  if (pathname === '/login') return null

  const handleAction = async (id: ActionId) => {
    setOpen(false)

    if (id === 'new-booking') {
      setLoadingRooms(true)
      try {
        const r = await roomsApi.list()
        setRooms(r)
      } catch {}
      setLoadingRooms(false)
      setModal('new-booking')
      return
    }

    if (id === 'walk-in') {
      setModal('walk-in')
      return
    }

    // Navigation actions
    navigate('/bookings', { state: { fabTab: FAB_TAB_MAP[id] ?? 'all' } })
  }

  return (
    <>
      {/* FAB + menu */}
      <div
        ref={containerRef}
        className="print:hidden fixed bottom-6 right-4 z-40 flex flex-col items-end gap-2 sm:right-6"
      >
        {/* Expanded action items */}
        <div
          className={cn(
            'flex flex-col items-end gap-2 transition-all duration-200',
            open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none translate-y-3',
          )}
          aria-hidden={!open}
        >
          {ACTIONS.map((action, i) => (
            <div
              key={action.id}
              className="flex items-center gap-2"
              style={{ transitionDelay: open ? `${i * 35}ms` : '0ms' }}
            >
              {/* Label chip */}
              <span className="rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-sm">
                {action.label}
              </span>
              {/* Icon button */}
              <button
                onClick={() => handleAction(action.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-card shadow-md transition-transform hover:scale-105 active:scale-95"
                aria-label={action.label}
              >
                <action.icon className={cn('h-4 w-4', action.color)} />
              </button>
            </div>
          ))}
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-xl',
            'bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-95',
            open && 'shadow-primary/30',
          )}
          aria-label={open ? 'Đóng menu' : 'Hành động nhanh'}
          aria-expanded={open}
        >
          {loadingRooms ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <Plus
              className="h-6 w-6 transition-transform duration-200"
              style={{ transform: open ? 'rotate(45deg)' : 'none' }}
            />
          )}
        </button>
      </div>

      {/* Modals opened by the FAB — z-50+ so they cover the FAB */}
      {modal === 'new-booking' && (
        <BookingFormModal
          rooms={rooms}
          onClose={() => setModal(null)}
          onCreated={(booking: Booking) => {
            setModal(null)
            showToast('Đặt phòng đã tạo thành công')
            navigate('/bookings', { state: { openBookingId: booking.id } })
          }}
        />
      )}

      {modal === 'walk-in' && (
        <WalkInWizard
          onClose={() => setModal(null)}
          onComplete={(booking: Booking) => {
            setModal(null)
            showToast('Walk-in thành công — khách đã nhận phòng')
            navigate('/bookings', { state: { openBookingId: booking.id } })
          }}
        />
      )}
    </>
  )
}
