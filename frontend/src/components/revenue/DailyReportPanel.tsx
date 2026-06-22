import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import type { BookingSummaryRow, DailyReport } from '../../types'
import { formatDate, formatVND } from '../../utils/format'

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-600',
}

function GuestTable({ rows, showCheckIn }: { rows: BookingSummaryRow[]; showCheckIn?: boolean }) {
  const { t } = useTranslation()
  if (rows.length === 0) return <p className="text-slate-400 text-sm py-2">{t('dailyReport.noArrivals')}</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-slate-500 uppercase tracking-wide">
          <th className="text-left py-1.5 font-semibold">{t('dailyReport.table.room')}</th>
          <th className="text-left py-1.5 font-semibold">{t('dailyReport.table.guest')}</th>
          {showCheckIn && <th className="text-left py-1.5 font-semibold">{t('dailyReport.table.checkIn')}</th>}
          <th className="text-left py-1.5 font-semibold">{t('dailyReport.table.checkOut')}</th>
          <th className="text-left py-1.5 font-semibold">{t('dailyReport.table.ota')}</th>
          <th className="text-right py-1.5 font-semibold">{t('dailyReport.table.total')}</th>
          <th className="text-right py-1.5 font-semibold">{t('dailyReport.table.collected')}</th>
          <th className="text-right py-1.5 font-semibold">{t('dailyReport.table.due')}</th>
          <th className="text-center py-1.5 font-semibold">{t('dailyReport.table.status')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((r) => {
          const due = Number(r.total_price) - Number(r.collected_amount)
          return (
            <tr key={r.id} className="hover:bg-slate-50">
              <td className="py-2 font-semibold text-slate-800">{r.room_number}</td>
              <td className="py-2 text-slate-700">{r.guest_name}</td>
              {showCheckIn && <td className="py-2 text-slate-500">{formatDate(r.check_in_date)}</td>}
              <td className="py-2 text-slate-500">{formatDate(r.check_out_date)}</td>
              <td className="py-2 text-slate-500">{t(`ota.${r.ota_source}` as any)}</td>
              <td className="py-2 text-right text-slate-700">{formatVND(r.total_price)}</td>
              <td className="py-2 text-right text-green-700">{formatVND(r.collected_amount)}</td>
              <td className={`py-2 text-right font-semibold ${due > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {due > 0 ? formatVND(due) : '✓'}
              </td>
              <td className="py-2 text-center">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t(`status.${r.status}` as any)}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t('dailyReport.title')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{dateLabel}</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Revenue & Housekeeping summary */}
      <div className={`grid gap-3 ${canSeeRevenue ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 max-w-xs'}`}>
        {canSeeRevenue && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xl font-bold text-blue-700">{formatVND(revenue.total_booked)}</p>
              <p className="text-xs font-medium text-blue-600 mt-1">{t('dailyReport.summary.totalBooked')}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xl font-bold text-green-700">{formatVND(revenue.total_collected)}</p>
              <p className="text-xs font-medium text-green-600 mt-1">{t('dailyReport.summary.collected')}</p>
            </div>
            <div className={`border rounded-xl p-4 ${Number(revenue.outstanding) > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-xl font-bold ${Number(revenue.outstanding) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {formatVND(revenue.outstanding)}
              </p>
              <p className={`text-xs font-medium mt-1 ${Number(revenue.outstanding) > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                {t('dailyReport.summary.outstanding')}
              </p>
            </div>
          </>
        )}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex gap-3 text-sm flex-wrap">
            {housekeeping.dirty > 0 && <span className="text-red-600 font-bold">{t('dailyReport.hk.dirty', { count: housekeeping.dirty })}</span>}
            {housekeeping.cleaning > 0 && <span className="text-orange-600 font-bold">{t('dailyReport.hk.cleaning', { count: housekeeping.cleaning })}</span>}
            {housekeeping.out_of_order > 0 && <span className="text-gray-500 font-bold">{t('dailyReport.hk.ooo', { count: housekeeping.out_of_order })}</span>}
            {housekeeping.available > 0 && <span className="text-green-600 font-bold">{t('dailyReport.hk.ready', { count: housekeeping.available })}</span>}
          </div>
          <p className="text-xs font-medium text-slate-500 mt-1">{t('dailyReport.summary.housekeeping')}</p>
        </div>
      </div>

      {/* Arrivals today */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">
          {t('dailyReport.arrivals')}
          <span className="ml-2 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{report.arrivals.length}</span>
        </h3>
        <GuestTable rows={report.arrivals} />
      </div>

      {/* Checkouts today */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">
          {t('dailyReport.departures')}
          <span className="ml-2 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{report.departures.length}</span>
        </h3>
        <GuestTable rows={report.departures} />
      </div>

      {/* In-house */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">
          {t('dailyReport.inHouse')}
          <span className="ml-2 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{report.in_house.length}</span>
        </h3>
        <GuestTable rows={report.in_house} showCheckIn />
      </div>

      {/* Tomorrow arrivals */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">
          {t('dailyReport.tomorrowArrivals')}
          <span className="ml-2 text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{report.tomorrow_arrivals.length}</span>
        </h3>
        <GuestTable rows={report.tomorrow_arrivals} />
      </div>
    </div>
  )
}
