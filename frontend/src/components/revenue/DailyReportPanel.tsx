import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { BookingSummaryRow, DailyReport } from '../../types'
import { formatDate, formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-muted text-muted-foreground',
}

function GuestTable({ rows, showCheckIn }: { rows: BookingSummaryRow[]; showCheckIn?: boolean }) {
  const { t } = useTranslation()
  if (rows.length === 0) return <p className="py-2 text-sm text-muted-foreground">{t('dailyReport.noArrivals')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 text-left font-semibold">{t('dailyReport.table.room')}</th>
            <th className="py-1.5 text-left font-semibold">{t('dailyReport.table.guest')}</th>
            {showCheckIn && <th className="py-1.5 text-left font-semibold">{t('dailyReport.table.checkIn')}</th>}
            <th className="py-1.5 text-left font-semibold">{t('dailyReport.table.checkOut')}</th>
            <th className="py-1.5 text-left font-semibold">{t('dailyReport.table.ota')}</th>
            <th className="py-1.5 text-right font-semibold">{t('dailyReport.table.total')}</th>
            <th className="py-1.5 text-right font-semibold">{t('dailyReport.table.collected')}</th>
            <th className="py-1.5 text-right font-semibold">{t('dailyReport.table.due')}</th>
            <th className="py-1.5 text-center font-semibold">{t('dailyReport.table.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const due = Number(r.total_price) - Number(r.collected_amount)
            return (
              <tr key={r.id} className="hover:bg-muted/50">
                <td className="py-2 font-semibold text-foreground">{r.room_number ?? '—'}</td>
                <td className="py-2 text-foreground">{r.guest_name}</td>
                {showCheckIn && <td className="py-2 text-muted-foreground">{formatDate(r.check_in_date)}</td>}
                <td className="py-2 text-muted-foreground">{formatDate(r.check_out_date)}</td>
                <td className="py-2 text-muted-foreground">{t(`ota.${r.ota_source}` as any)}</td>
                <td className="py-2 text-right text-foreground">{formatVND(r.total_price)}</td>
                <td className="py-2 text-right text-emerald-700">{formatVND(r.collected_amount)}</td>
                <td className={cn('py-2 text-right font-semibold', due > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  {due > 0 ? formatVND(due) : '✓'}
                </td>
                <td className="py-2 text-center">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_BADGE[r.status] ?? 'bg-muted text-muted-foreground')}>
                    {t(`status.${r.status}` as any)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface Props {
  report: DailyReport
  selectedDate: string
  onDateChange: (d: string) => void
}

export default function DailyReportPanel({ report, selectedDate, onDateChange }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const canSeeRevenue = user?.role !== 'RECEPTIONIST'
  const { revenue, housekeeping } = report

  const dateLabel = new Date(report.date + 'T00:00:00').toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t('dailyReport.title')}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <Input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="h-9 w-auto" />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {t('dailyReport.print')}
          </Button>
        </div>
      </div>

      <div className={cn('grid gap-3', canSeeRevenue ? 'grid-cols-2 lg:grid-cols-4' : 'max-w-xs grid-cols-1')}>
        {canSeeRevenue && (
          <>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xl font-bold text-blue-700">{formatVND(revenue.total_booked)}</p>
              <p className="mt-1 text-xs font-medium text-blue-600">{t('dailyReport.summary.totalBooked')}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xl font-bold text-emerald-700">{formatVND(revenue.total_collected)}</p>
              <p className="mt-1 text-xs font-medium text-emerald-600">{t('dailyReport.summary.collected')}</p>
            </div>
            <div className={cn('rounded-xl border p-4', Number(revenue.outstanding) > 0 ? 'border-red-200 bg-red-50' : 'border-border bg-muted/50')}>
              <p className={cn('text-xl font-bold', Number(revenue.outstanding) > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {formatVND(revenue.outstanding)}
              </p>
              <p className={cn('mt-1 text-xs font-medium', Number(revenue.outstanding) > 0 ? 'text-red-500' : 'text-muted-foreground')}>
                {t('dailyReport.summary.outstanding')}
              </p>
            </div>
          </>
        )}
        <div className="rounded-xl border border-border bg-muted/50 p-4">
          <div className="flex flex-wrap gap-3 text-sm">
            {housekeeping.dirty > 0 && <span className="font-bold text-red-600">{t('dailyReport.hk.dirty', { count: housekeeping.dirty })}</span>}
            {housekeeping.cleaning > 0 && <span className="font-bold text-orange-600">{t('dailyReport.hk.cleaning', { count: housekeeping.cleaning })}</span>}
            {housekeeping.out_of_order > 0 && <span className="font-bold text-muted-foreground">{t('dailyReport.hk.ooo', { count: housekeeping.out_of_order })}</span>}
            {housekeeping.available > 0 && <span className="font-bold text-emerald-600">{t('dailyReport.hk.ready', { count: housekeeping.available })}</span>}
          </div>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{t('dailyReport.summary.housekeeping')}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-bold text-foreground">
          {t('dailyReport.arrivals')}
          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{report.arrivals.length}</span>
        </h3>
        <GuestTable rows={report.arrivals} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-bold text-foreground">
          {t('dailyReport.departures')}
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{report.departures.length}</span>
        </h3>
        <GuestTable rows={report.departures} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-bold text-foreground">
          {t('dailyReport.inHouse')}
          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{report.in_house.length}</span>
        </h3>
        <GuestTable rows={report.in_house} showCheckIn />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-bold text-foreground">
          {t('dailyReport.tomorrowArrivals')}
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{report.tomorrow_arrivals.length}</span>
        </h3>
        <GuestTable rows={report.tomorrow_arrivals} />
      </div>
    </div>
  )
}
