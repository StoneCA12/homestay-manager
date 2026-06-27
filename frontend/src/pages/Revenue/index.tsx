import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddExpenseModal from '../../components/expenses/AddExpenseModal'
import DailyReportPanel from '../../components/revenue/DailyReportPanel'
import Layout from '../../components/layout/Layout'
import { expensesApi, revenueApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { DailyReport, Expense, MonthlyRevenue } from '../../types'
import { formatVND } from '../../utils/format'

function DeleteConfirmDialog({ expense, onConfirm, onCancel }: { expense: Expense; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-slate-800 mb-2">{t('revenue.expenses.deleteDialog.title')}</h3>
        <p className="text-sm text-slate-600 mb-5">
          {t('revenue.expenses.deleteDialog.message', {
            amount: formatVND(expense.amount),
            category: expense.category,
          })}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            {t('revenue.expenses.deleteDialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

type Tab = 'report' | 'revenue' | 'expenses'

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function defaultRange(): { start: string; end: string } {
  const today = new Date()
  if (today.getDate() === 1) {
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    return { start: toISO(prevMonth), end: toISO(lastDay) }
  }
  return {
    start: toISO(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: toISO(today),
  }
}

const ROOM_TYPE_COLORS: Record<string, string> = {
  FAMILY:     'bg-purple-100 text-purple-800',
  WINDOW:     'bg-blue-100 text-blue-800',
  BALCONY:    'bg-green-100 text-green-800',
  REGULAR:    'bg-slate-100 text-slate-700',
  UNASSIGNED: 'bg-orange-100 text-orange-800',
}

export default function RevenuePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const isAdminOrAbove = user?.role === 'OWNER' || user?.role === 'ADMIN'

  // OWNER: all 3 tabs  |  ADMIN: report + expenses  |  RECEPTIONIST: report only
  const visibleTabs: Tab[] = isOwner
    ? ['report', 'revenue', 'expenses']
    : isAdminOrAbove
      ? ['report', 'expenses']
      : ['report']

  const [tab, setTab] = useState<Tab>('report')
  const [report, setReport] = useState<DailyReport | null>(null)
  const [reportDate, setReportDate] = useState(toISO(new Date()))
  const [reportLoading, setReportLoading] = useState(true)

  const range = defaultRange()
  const [startDate, setStartDate] = useState(range.start)
  const [endDate, setEndDate] = useState(range.end)
  const [summary, setSummary] = useState<MonthlyRevenue | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const { showToast } = useToast()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<Expense | null>(null)

  useEffect(() => {
    revenueApi.dailyReport(reportDate).then(setReport).finally(() => setReportLoading(false))
  }, [])

  const loadSummary = (s = startDate, e = endDate) => {
    setSummaryLoading(true)
    revenueApi.summary(s, e).then(setSummary).finally(() => setSummaryLoading(false))
  }

  const loadExpenses = (s = startDate, e = endDate) => {
    setExpensesLoading(true)
    expensesApi.list({ start_date: s, end_date: e }).then(setExpenses).finally(() => setExpensesLoading(false))
  }

  const applyRange = () => {
    if (tab === 'revenue') loadSummary()
    if (tab === 'expenses') {
      loadExpenses()
      if (!summary && isOwner) loadSummary()
    }
  }

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab)
    if (nextTab === 'revenue' && !summary) loadSummary()
    if (nextTab === 'expenses' && expenses.length === 0) {
      loadExpenses()
      if (!summary && isOwner) loadSummary()
    }
  }

  const handleDeleteExpense = async (expense: Expense) => {
    try {
      await expensesApi.delete(expense.id)
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
      setDeleteDialog(null)
      showToast(t('revenue.expenses.toast.deleted'))
    } catch {
      showToast(t('revenue.expenses.toast.deleteFailed'), 'error')
    }
  }

  const handleReportDateChange = (d: string) => {
    setReportDate(d)
    setReportLoading(true)
    revenueApi.dailyReport(d).then(setReport).finally(() => setReportLoading(false))
  }

  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0)
  const netRevenue = summary ? Number(summary.total_net_revenue) : 0
  const netOperating = netRevenue - totalExpenses
  const occupancyPct = summary ? Math.round(Number(summary.occupancy_rate) * 100) : 0

  const collectionRate = summary && Number(summary.total_revenue) > 0
    ? Math.round((Number(summary.total_collected) / Number(summary.total_revenue)) * 100)
    : 0

  const handlePrint = () => window.print()

  const handleDownloadCSV = () => {
    if (!summary) return
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const rows: string[][] = []

    rows.push(['BÁO CÁO DOANH THU', '', summary.start_date + ' → ' + summary.end_date])
    rows.push([])
    rows.push(['TÓM TẮT', 'GIÁ TRỊ'])
    rows.push(['Số đặt phòng', String(summary.total_bookings)])
    rows.push(['Tỷ lệ lấp đầy', `${Math.round(Number(summary.occupancy_rate) * 100)}%`])
    rows.push(['Doanh thu gộp', summary.total_revenue])
    rows.push(['Hoa hồng OTA', String(Number(summary.total_revenue) - Number(summary.total_net_revenue))])
    rows.push(['Doanh thu thuần', summary.total_net_revenue])
    rows.push(['Đã thu phòng', summary.total_collected])
    if (Number(summary.bike_revenue) > 0) {
      rows.push(['Doanh thu xe máy', summary.bike_revenue])
      rows.push(['Đã thu xe máy', summary.bike_collected])
      rows.push(['Còn nợ xe máy', summary.bike_outstanding])
    }
    rows.push(['Chi phí', String(totalExpenses)])
    rows.push(['Lợi nhuận', String(netOperating)])
    rows.push([])

    rows.push(['THEO NGUỒN ĐẶT PHÒNG', 'Số phòng', 'Doanh thu', 'Đã thu', 'Tỷ lệ HH', 'Doanh thu thuần'])
    summary.by_source.forEach((s) => {
      rows.push([s.source, String(s.bookings), s.revenue, s.collected, `${Math.round(Number(s.commission_rate) * 100)}%`, s.net_revenue])
    })
    rows.push([])

    if (expenses.length > 0) {
      rows.push(['CHI PHÍ', 'Ngày', 'Danh mục', 'Số tiền', 'Mô tả'])
      expenses.forEach((e) => {
        rows.push(['', e.expense_date, e.category, e.amount, e.description ?? ''])
      })
    }

    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `doanh-thu-${summary.start_date}-${summary.end_date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout>
      <div className="p-8 max-w-6xl print:p-4">
        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-bold text-slate-800">{t('revenue.title')}</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit print:hidden">
          {visibleTabs.map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => switchTab(tabKey)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === tabKey ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tabKey === 'report' ? t('revenue.tabs.dailyReport') : tabKey === 'revenue' ? t('revenue.tabs.revenue') : t('revenue.tabs.expenses')}
            </button>
          ))}
        </div>

        {/* Daily Report tab */}
        {tab === 'report' && (
          reportLoading
            ? <p className="text-slate-500 text-sm">{t('bookings.loading')}</p>
            : report && (
              <DailyReportPanel
                report={report}
                selectedDate={reportDate}
                onDateChange={handleReportDateChange}
              />
            )
        )}

        {/* Date range picker */}
        {(tab === 'revenue' || tab === 'expenses') && (
          <div className="flex items-center gap-3 mb-6 print:hidden">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">{t('revenue.dateRange.from')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">{t('revenue.dateRange.to')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={applyRange}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              {t('revenue.dateRange.apply')}
            </button>
            {tab === 'revenue' && summary && (
              <button
                onClick={handleDownloadCSV}
                className="ml-2 border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                ⬇️ Tải CSV
              </button>
            )}
          </div>
        )}

        {/* Revenue tab */}
        {tab === 'revenue' && (
          summaryLoading
            ? <p className="text-slate-500 text-sm">{t('bookings.loading')}</p>
            : summary && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
                  {[
                    { label: t('revenue.summary.totalBookings'), value: String(summary.total_bookings), color: 'bg-slate-50 border-slate-200 text-slate-700' },
                    { label: t('revenue.occupancyRate'),          value: `${occupancyPct}%`,             color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                    { label: t('revenue.summary.grossRevenue'),   value: formatVND(summary.total_revenue),       color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { label: t('revenue.bySource.commission'),    value: formatVND(Number(summary.total_revenue) - Number(summary.total_net_revenue)), color: 'bg-orange-50 border-orange-200 text-orange-700' },
                    { label: t('revenue.summary.netRevenue'),     value: formatVND(summary.total_net_revenue),   color: 'bg-green-50 border-green-200 text-green-700' },
                    { label: t('revenue.summary.collected'),      value: `${formatVND(summary.total_collected)} (${collectionRate}%)`, color: 'bg-teal-50 border-teal-200 text-teal-700' },
                    ...(Number(summary.bike_revenue) > 0 ? [
                      { label: '🏍️ Doanh thu xe máy',  value: formatVND(summary.bike_revenue),    color: 'bg-purple-50 border-purple-200 text-purple-700' },
                      { label: '🏍️ Xe máy đã thu',     value: formatVND(summary.bike_collected),  color: 'bg-violet-50 border-violet-200 text-violet-700' },
                      ...(Number(summary.bike_outstanding) > 0
                        ? [{ label: '🏍️ Xe máy còn lại', value: formatVND(summary.bike_outstanding), color: 'bg-red-50 border-red-200 text-red-700' }]
                        : [{ label: '🏍️ Xe máy đã đủ',   value: '✓ Đủ',                             color: 'bg-green-50 border-green-200 text-green-700' }]),
                    ] : []),
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-xl border p-4 ${color}`}>
                      <p className="text-lg font-bold">{value}</p>
                      <p className="text-xs font-medium mt-1 opacity-70">{label}</p>
                    </div>
                  ))}
                </div>

                {/* By-source table */}
                {summary.by_source.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-6">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-gray-200">
                        <tr>
                          {[
                            t('revenue.bySource.source'),
                            t('revenue.bySource.bookings'),
                            t('revenue.bySource.gross'),
                            t('revenue.bySource.commission'),
                            t('revenue.bySource.net'),
                            t('revenue.bySource.collected'),
                            t('revenue.summary.outstanding'),
                          ].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.by_source.map((row) => {
                          const commission = Number(row.revenue) * Number(row.commission_rate)
                          const outstanding = Number(row.revenue) - Number(row.collected)
                          return (
                            <tr key={row.source} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-700">{row.source}</td>
                              <td className="px-4 py-3 text-slate-600">{row.bookings}</td>
                              <td className="px-4 py-3 text-slate-700">{formatVND(row.revenue)}</td>
                              <td className="px-4 py-3 text-orange-600">
                                {Number(row.commission_rate) > 0
                                  ? `${formatVND(commission)} (${Math.round(Number(row.commission_rate) * 100)}%)`
                                  : '—'
                                }
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800">{formatVND(row.net_revenue)}</td>
                              <td className="px-4 py-3 text-green-700">{formatVND(row.collected)}</td>
                              <td className={`px-4 py-3 ${outstanding > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
                                {outstanding > 0 ? formatVND(outstanding) : '✓'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm mb-6">{t('revenue.noData')}</p>
                )}

                {/* By room type table */}
                {summary.by_room_type.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-6">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('revenue.byRoomType.title')}</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-gray-200">
                        <tr>
                          {[
                            t('revenue.byRoomType.roomType'),
                            t('revenue.byRoomType.bookings'),
                            t('revenue.byRoomType.nights'),
                            t('revenue.byRoomType.gross'),
                            t('revenue.byRoomType.net'),
                          ].map((h) => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.by_room_type.map((row) => (
                          <tr key={row.room_type} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROOM_TYPE_COLORS[row.room_type] ?? 'bg-gray-100 text-gray-700'}`}>
                                {row.room_type === 'UNASSIGNED' ? t('revenue.byRoomType.UNASSIGNED') : t(`roomType.${row.room_type}` as any)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.bookings}</td>
                            <td className="px-4 py-3 text-slate-600">{row.nights}</td>
                            <td className="px-4 py-3 text-slate-700">{formatVND(row.revenue)}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{formatVND(row.net_revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Payment method breakdown */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('revenue.byPayment.title')}</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: t('revenue.byPayment.cash'),         value: summary.by_payment_method.cash,         color: 'text-green-700' },
                      { label: t('revenue.byPayment.bankTransfer'), value: summary.by_payment_method.bank_transfer, color: 'text-blue-700' },
                      { label: t('revenue.byPayment.ota'),          value: summary.by_payment_method.ota_collected, color: 'text-purple-700' },
                      { label: t('revenue.byPayment.total'),        value: summary.by_payment_method.total,         color: 'text-slate-800' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="border border-gray-100 rounded-lg p-3">
                        <p className={`text-base font-bold ${color}`}>{formatVND(value)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tax report — admin/owner only */}
                {isAdminOrAbove && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-amber-900">{t('revenue.taxReport.title')}</h3>
                        <p className="text-xs text-amber-700 mt-0.5">{t('revenue.taxReport.note')}</p>
                      </div>
                      <button
                        onClick={handlePrint}
                        className="print:hidden bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {t('revenue.taxReport.print')}
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>{t('revenue.taxReport.period')}</span>
                        <span className="font-medium">{summary.start_date} → {summary.end_date}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>{t('revenue.taxReport.occupancyRate')}</span>
                        <span className="font-medium">{occupancyPct}%</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>{t('revenue.taxReport.grossRevenue')}</span>
                        <span className="font-semibold">{formatVND(summary.total_revenue)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>{t('revenue.taxReport.otaCommission')}</span>
                        <span className="font-semibold text-orange-700">− {formatVND(Number(summary.total_revenue) - Number(summary.total_net_revenue))}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-800 border-t pt-2">
                        <span>{t('revenue.taxReport.netRevenue')}</span>
                        <span>{formatVND(summary.total_net_revenue)}</span>
                      </div>
                      {totalExpenses > 0 && (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>{t('revenue.taxReport.totalExpenses')}</span>
                            <span className="font-semibold text-red-600">− {formatVND(totalExpenses)}</span>
                          </div>
                          <div className={`flex justify-between font-bold border-t pt-2 ${netOperating >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            <span>{t('revenue.taxReport.profit')}</span>
                            <span>{formatVND(Math.abs(netOperating))}{netOperating < 0 ? ' (lỗ)' : ''}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
        )}

        {/* Expenses tab */}
        {tab === 'expenses' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-600">
                {t('revenue.expenses.count', { count: expenses.length })}
                {expenses.length > 0 && ` · ${formatVND(totalExpenses)}`}
              </h2>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                {t('revenue.expenses.addExpense')}
              </button>
            </div>

            {expensesLoading ? (
              <p className="text-slate-500 text-sm">{t('bookings.loading')}</p>
            ) : expenses.length === 0 ? (
              <p className="text-slate-400 text-sm">{t('revenue.expenses.noExpenses')}</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr>
                      {[
                        t('revenue.expenses.table.date'),
                        t('revenue.expenses.table.category'),
                        t('revenue.expenses.table.description'),
                        t('revenue.expenses.table.amount'),
                        t('revenue.expenses.table.recordedBy'),
                        '',
                      ].map((h, i) => (
                        <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{e.expense_date}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {t(`expenseCategory.${e.category}` as any)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{e.description ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{formatVND(e.amount)}</td>
                        <td className="px-4 py-3 text-slate-500">{e.recorded_by_name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingExpense(e)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {t('common.edit')}
                            </button>
                            {isAdminOrAbove && (
                              <button
                                onClick={() => setDeleteDialog(e)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                              >
                                {t('common.delete')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {summary && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('revenue.expenses.pl.title')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('revenue.expenses.pl.grossRevenue')}</span>
                    <span className="font-semibold text-slate-800">{formatVND(netRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">{t('revenue.expenses.pl.totalExpenses')}</span>
                    <span className="font-semibold text-red-600">− {formatVND(totalExpenses)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span className="text-slate-700">{t('revenue.expenses.pl.net')}</span>
                    <span className={netOperating >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {netOperating >= 0 ? '' : '− '}{formatVND(Math.abs(netOperating))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showExpenseForm && (
        <AddExpenseModal
          onClose={() => setShowExpenseForm(false)}
          onSaved={(expense) => {
            setExpenses((prev) => [expense, ...prev])
            setShowExpenseForm(false)
            showToast(t('revenue.expenses.toast.created'))
          }}
        />
      )}

      {editingExpense && (
        <AddExpenseModal
          editingExpense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={(updated) => {
            setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
            setEditingExpense(null)
            showToast(t('revenue.expenses.toast.updated'))
          }}
        />
      )}

      {deleteDialog && (
        <DeleteConfirmDialog
          expense={deleteDialog}
          onConfirm={() => handleDeleteExpense(deleteDialog)}
          onCancel={() => setDeleteDialog(null)}
        />
      )}
    </Layout>
  )
}
