import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CalendarDays, DoorOpen, FileText, User, X } from 'lucide-react'
import { bookingsApi, guestsApi } from '../../services/api'
import type { Booking, OTASource, Room } from '../../types'
import { formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseConflict, extractErrorMessage, type ConflictDetail } from '../../lib/conflictParser'
import { resolveRoomWarnings } from '../../lib/bookingWarnings'
import ConflictAlert from './ConflictAlert'
import WarningBanner from './WarningBanner'

type FormTab = 'guest' | 'stay' | 'room' | 'payment' | 'notes'

interface FormState {
  room_id: string
  guest_name: string
  guest_phone: string
  guest_id_type: string
  guest_id_number: string
  check_in_date: string
  check_out_date: string
  num_guests: string
  ota_source: string
  total_price: string
  deposit_amount: string
  deposit_payment_method: string
  booking_ref: string
  notes: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

const EMPTY: FormState = {
  room_id: '', guest_name: '', guest_phone: '',
  guest_id_type: '', guest_id_number: '',
  check_in_date: '', check_out_date: '',
  num_guests: '1', ota_source: 'DIRECT',
  total_price: '', deposit_amount: '',
  deposit_payment_method: 'CASH',
  booking_ref: '', notes: '',
}

const OTA_SOURCES: OTASource[] = ['DIRECT', 'AGODA', 'BOOKING_COM', 'TRAVELOKA', 'ZALO']
const ID_TYPES = ['CCCD', 'CMND', 'PASSPORT', 'Khác']
const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'OTA_COLLECTED', label: 'OTA thu' },
]

// Which required fields belong to which tab (for validation routing)
const TAB_REQUIRED: Record<FormTab, (keyof FormState)[]> = {
  guest:   ['guest_name'],
  stay:    ['check_in_date', 'check_out_date'],
  room:    [],
  payment: ['total_price'],
  notes:   [],
}

interface TabDef { id: FormTab; label: string; icon: React.ElementType }
const TABS: TabDef[] = [
  { id: 'guest',   label: 'Khách',     icon: User },
  { id: 'stay',    label: 'Lưu trú',   icon: CalendarDays },
  { id: 'room',    label: 'Phòng',     icon: DoorOpen },
  { id: 'payment', label: 'Thanh toán', icon: Banknote },
  { id: 'notes',   label: 'Ghi chú',   icon: FileText },
]

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  )
}

interface Props {
  rooms: Room[]
  onClose: () => void
  onCreated: (booking: Booking) => void
  defaultRoomId?: number
}

export default function BookingFormModal({ rooms, onClose, onCreated, defaultRoomId }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    room_id: defaultRoomId ? String(defaultRoomId) : '',
  }))
  const [activeTab, setActiveTab] = useState<FormTab>('guest')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [conflict, setConflict] = useState<ConflictDetail | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [autofilled, setAutofilled] = useState(false)

  const nights = useMemo(() => {
    if (!form.check_in_date || !form.check_out_date) return 0
    return Math.max(0, Math.round(
      (new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime()) / 86_400_000,
    ))
  }, [form.check_in_date, form.check_out_date])

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === Number(form.room_id)),
    [rooms, form.room_id],
  )

  // Auto-fill price when room + dates set and price is still empty
  useEffect(() => {
    if (selectedRoom && nights > 0 && !form.total_price) {
      setForm((f) => ({ ...f, total_price: String(Math.round(Number(selectedRoom.base_price) * nights)) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id, nights])

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.value
      setForm((f) => ({ ...f, [k]: val }))
      if (fieldErrors[k]) setFieldErrors((fe) => { const n = { ...fe }; delete n[k]; return n })
      if (k === 'guest_phone') setAutofilled(false)
      if (k === 'room_id' || k === 'check_in_date' || k === 'check_out_date') setConflict(null)
    }

  const handlePhoneBlur = async () => {
    const phone = form.guest_phone.trim()
    if (phone.length < 7 || autofilled) return
    setLookingUp(true)
    try {
      const g = await guestsApi.lookup(phone)
      setForm((f) => ({
        ...f,
        guest_name: g.full_name,
        guest_id_type: g.id_type ?? '',
        guest_id_number: g.id_number ?? '',
      }))
      setAutofilled(true)
    } catch {
      // 404 = new guest
    } finally {
      setLookingUp(false)
    }
  }

  const validate = (): boolean => {
    const errors: FieldErrors = {}
    if (!form.guest_name.trim()) errors.guest_name = 'Vui lòng nhập tên khách'
    if (!form.check_in_date) errors.check_in_date = 'Vui lòng chọn ngày nhận phòng'
    if (!form.check_out_date) errors.check_out_date = 'Vui lòng chọn ngày trả phòng'
    if (form.check_in_date && form.check_out_date && form.check_out_date <= form.check_in_date) {
      errors.check_out_date = 'Ngày trả phòng phải sau ngày nhận phòng'
    }
    if (!form.total_price || Number(form.total_price) < 0) errors.total_price = 'Vui lòng nhập giá phòng'
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      // Jump to first tab with an error
      for (const tab of TABS.map((t) => t.id)) {
        if (TAB_REQUIRED[tab].some((f) => errors[f])) {
          setActiveTab(tab)
          break
        }
      }
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitError('')
    setSubmitting(true)
    try {
      const created = await bookingsApi.create({
        room_id: form.room_id ? Number(form.room_id) : null,
        guest_name: form.guest_name.trim(),
        guest_phone: form.guest_phone.trim() || undefined,
        guest_id_type: form.guest_id_type || undefined,
        guest_id_number: form.guest_id_number.trim() || undefined,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        num_guests: Number(form.num_guests) || 1,
        ota_source: form.ota_source,
        total_price: Number(form.total_price),
        deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : undefined,
        deposit_payment_method: form.deposit_payment_method || undefined,
        booking_ref: form.booking_ref.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      onCreated(created)
    } catch (err: unknown) {
      const parsed = parseConflict(err)
      if (parsed) { setConflict(parsed); setActiveTab('room') }
      else { setSubmitError(extractErrorMessage(err)) }
    } finally {
      setSubmitting(false)
    }
  }

  // Tab completion status
  const tabComplete = (tab: FormTab): boolean =>
    TAB_REQUIRED[tab].every((f) => !!form[f as keyof FormState])
  const tabHasError = (tab: FormTab): boolean =>
    TAB_REQUIRED[tab].some((f) => !!fieldErrors[f as keyof FormState])

  const inputCls = 'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

  const suggestedPrice = selectedRoom && nights > 0
    ? Math.round(Number(selectedRoom.base_price) * nights)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl">

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-bold text-foreground">{t('bookingForm.title')}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex flex-shrink-0 border-b">
          {TABS.map((tab) => {
            const complete = tabComplete(tab.id)
            const hasErr = tabHasError(tab.id)
            const active = activeTab === tab.id
            const hasRequired = TAB_REQUIRED[tab.id].length > 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative',
                  active
                    ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative">
                  <tab.icon className="h-4 w-4" />
                  {hasRequired && (
                    <span
                      className={cn(
                        'absolute -right-1 -top-1 h-2 w-2 rounded-full border border-card',
                        hasErr ? 'bg-destructive' : complete ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                      )}
                    />
                  )}
                </span>
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Guest ── */}
          {activeTab === 'guest' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={`${t('bookingForm.guestPhone')}${lookingUp ? ' …' : autofilled ? ' ✓' : ''}`}
                >
                  <Input
                    value={form.guest_phone}
                    onChange={set('guest_phone')}
                    onBlur={handlePhoneBlur}
                    placeholder="09xx..."
                    className="h-9"
                  />
                </Field>
                <Field label={`${t('bookingForm.guestName')} *`} error={fieldErrors.guest_name}>
                  <Input
                    value={form.guest_name}
                    onChange={set('guest_name')}
                    className={cn('h-9', fieldErrors.guest_name && 'border-destructive')}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('bookingForm.idType')}>
                  <select value={form.guest_id_type} onChange={set('guest_id_type')} className={inputCls}>
                    <option value="">{t('bookingForm.selectIdType')}</option>
                    {ID_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label={t('bookingForm.idNumber')}>
                  <Input value={form.guest_id_number} onChange={set('guest_id_number')} placeholder="012345678" className="h-9" />
                </Field>
              </div>

              <Field label={t('bookingForm.otaSource')}>
                <select value={form.ota_source} onChange={set('ota_source')} className={inputCls}>
                  {OTA_SOURCES.map((s) => <option key={s} value={s}>{t(`ota.${s}` as any)}</option>)}
                </select>
              </Field>

              {autofilled && (
                <p className="text-xs text-emerald-600">Đã tìm thấy khách quen — thông tin được điền tự động</p>
              )}
            </div>
          )}

          {/* ── Stay ── */}
          {activeTab === 'stay' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={`${t('bookingForm.checkIn')} *`} error={fieldErrors.check_in_date}>
                  <Input
                    type="date"
                    value={form.check_in_date}
                    onChange={set('check_in_date')}
                    className={cn('h-9', fieldErrors.check_in_date && 'border-destructive')}
                  />
                </Field>
                <Field label={`${t('bookingForm.checkOut')} *`} error={fieldErrors.check_out_date}>
                  <Input
                    type="date"
                    value={form.check_out_date}
                    min={form.check_in_date || undefined}
                    onChange={set('check_out_date')}
                    className={cn('h-9', fieldErrors.check_out_date && 'border-destructive')}
                  />
                </Field>
              </div>

              {nights > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Số đêm:</span>
                  <span className="font-bold text-foreground">{nights}</span>
                </div>
              )}

              <Field label="Số khách">
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={form.num_guests}
                  onChange={set('num_guests')}
                  className="h-9 w-24"
                />
              </Field>
            </div>
          )}

          {/* ── Room ── */}
          {activeTab === 'room' && (
            <div className="space-y-3">
              <Field label={t('bookingForm.room')}>
                <select
                  value={form.room_id}
                  onChange={set('room_id')}
                  className={inputCls}
                >
                  <option value="">{t('bookingForm.selectRoomOptional')}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      P.{r.room_number}
                      {r.display_status === 'OCCUPIED' ? ' 🚫' : ''}
                      {r.housekeeping_status !== 'AVAILABLE' ? ` (${
                        r.housekeeping_status === 'DIRTY' ? 'Chưa dọn' :
                        r.housekeeping_status === 'CLEANING' ? 'Đang dọn' : 'Tạm ngừng'
                      })` : ''}
                      {` · ${t(`roomType.${r.room_type}` as any)} · ${formatVND(r.base_price)}/đêm`}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedRoom && (
                <div className="rounded-xl border bg-muted/20 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loại phòng</span>
                    <span className="font-medium">{selectedRoom.room_type} · Tầng {selectedRoom.floor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sức chứa</span>
                    <span className="font-medium">{selectedRoom.capacity} khách</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giá/đêm</span>
                    <span className="font-medium">{formatVND(selectedRoom.base_price)}</span>
                  </div>
                  {nights > 0 && (
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-muted-foreground">{nights} đêm</span>
                      <span className="font-bold text-foreground">{formatVND(Number(selectedRoom.base_price) * nights)}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedRoom && (
                <WarningBanner
                  warnings={resolveRoomWarnings(selectedRoom)}
                  key={selectedRoom.id}
                />
              )}

              {conflict && (
                <ConflictAlert
                  conflict={conflict}
                  onSelectRoom={(roomId) => { setForm((f) => ({ ...f, room_id: String(roomId) })); setConflict(null) }}
                />
              )}

              {!form.room_id && (
                <p className="text-xs text-muted-foreground">Phòng là tùy chọn — có thể gán sau khi tạo đặt phòng</p>
              )}
            </div>
          )}

          {/* ── Payment ── */}
          {activeTab === 'payment' && (
            <div className="space-y-3">
              <Field label={`${t('bookingForm.totalPrice')} * (VND)`} error={fieldErrors.total_price}>
                <Input
                  type="number"
                  min="0"
                  value={form.total_price}
                  onChange={set('total_price')}
                  placeholder="500000"
                  className={cn('h-9', fieldErrors.total_price && 'border-destructive')}
                />
              </Field>

              {suggestedPrice !== null && String(suggestedPrice) !== form.total_price && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, total_price: String(suggestedPrice) }))}
                  className="text-xs text-primary underline-offset-2 hover:underline"
                >
                  Dùng giá gợi ý: {formatVND(suggestedPrice)}
                  {nights > 0 && ` (${formatVND(selectedRoom!.base_price)} × ${nights} đêm)`}
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('bookingForm.deposit')}>
                  <Input
                    type="number"
                    min="0"
                    value={form.deposit_amount}
                    onChange={set('deposit_amount')}
                    placeholder="0"
                    className="h-9"
                  />
                </Field>
                <Field label="Hình thức đặt cọc">
                  <select value={form.deposit_payment_method} onChange={set('deposit_payment_method')} className={inputCls}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {form.total_price && form.deposit_amount && Number(form.deposit_amount) > 0 && (
                <div className="rounded-xl border bg-muted/20 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng tiền</span>
                    <span className="font-medium">{formatVND(form.total_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Đặt cọc</span>
                    <span className="font-medium text-emerald-600">−{formatVND(form.deposit_amount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-semibold">Còn lại</span>
                    <span className="font-bold text-foreground">
                      {formatVND(Math.max(0, Number(form.total_price) - Number(form.deposit_amount)))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notes ── */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <Field label={t('bookingForm.bookingRef')}>
                <Input
                  value={form.booking_ref}
                  onChange={set('booking_ref')}
                  placeholder="OTA confirmation # (nếu có)"
                  className="h-9"
                />
              </Field>

              <Field label={t('bookingForm.notes')}>
                <textarea
                  value={form.notes}
                  onChange={set('notes')}
                  rows={4}
                  placeholder="Yêu cầu đặc biệt, ghi chú nội bộ..."
                  className={cn(inputCls, 'resize-none')}
                />
              </Field>

              <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground/60">Dịch vụ bổ sung</p>
                <p>Thuê xe máy — thêm sau khi nhận phòng trong mục Xe máy</p>
                <p>Nhận phòng sớm / trả phòng muộn — có thể thu phụ phí qua trang chi tiết đặt phòng</p>
              </div>
            </div>
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="flex-shrink-0 px-5 pb-2">
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex-shrink-0 border-t px-5 pb-5 pt-3">
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="min-w-[80px]">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? t('bookingForm.submitting') : t('bookingForm.submit')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
