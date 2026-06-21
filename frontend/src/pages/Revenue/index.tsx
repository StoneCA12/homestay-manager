import { useEffect, useState } from 'react'
import AddExpenseModal from '../../components/expenses/AddExpenseModal'
import DailyReportPanel from '../../components/revenue/DailyReportPanel'
import Layout from '../../components/layout/Layout'
import { expensesApi, revenueApi } from '../../services/api'
import type { DailyReport, Expense, ExpenseCategory, MonthlyRevenue } from '../../types'
import { formatVND } from '../../utils/format'

type Tab = 'report' | 'revenue' | 'expenses'

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  CLEANING: 'Cleaning', SUPPLIES: 'Supplies', OTHER: 'Other',
  UTILITIES: 'Utilities', SALARIES: 'Salaries', MAINTENANCE: 'Maintenance',
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

function defaultRange(): { start: string; end: string } {
  const today = new Date()
  // On 1st of month, default to full previous month
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

export default function RevenuePage() {
  const [tab, setTab] = useState<Tab>('report')
  const [report, setReport] = useState<DailyReport | null>(null)
  const [reportDate, setReportDate] = useState(toISO(new Date()))
  const [reportLoading, setReportLoading] = useState(true)

  const range = defaultRange()
  const [startDate, setStartDate] = useState(range.start)
  const [endDate, setEndDate] = useState(range.end)
  const [summary, setSummary] = useState<MonthlyRevenue | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  // Load daily report on mount
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
    if (tab === 'expenses') loadExpenses()
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    if (t === 'revenue' && !summary) loadSummary()
    if (t === 'expenses' && expenses.length === 0) loadExpenses()
  }

  const handleReportDateChange = (d: string) => {
    setReportDate(d)
    setReportLoading(true)
    revenueApi.dailyReport(d).then(setReport).finally(() => setReportLoading(false))
  }

  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0)
  const grossRevenue = summary ? Number(summary.total_revenue) : 0
  const netOperating = grossRevenue - totalExpenses

  const collectionRate = summary && Number(summary.total_revenue) > 0
    ? Math.round((Number(summary.total_collected) / Number(summary.total_revenue)) * 100)
    : 0

  return (
    <Layout>
      <div className="p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Revenue</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
          {(['report', 'revenue', 'expenses'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t === 'report' ? 'Daily Report' : t === 'revenue' ? 'Revenue' : 'Expenses'}
            </button>
          ))}
        </div>

        {/* Daily Report tab */}
        {tab === 'report' && (
          reportLoading
            ? <p className="text-slate-500 text-sm">Loading…</p>
            : report && (
              <DailyReportPanel
                report={report}
                selectedDate={reportDate}
                onDateChange={handleReportDateChange}
              />
            )
        )}

        {/* Date range picker (shared between revenue + expenses tabs) */}
        {(tab === 'revenue' || tab === 'expenses') && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">To</label>
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
              Apply
            </button>
          </div>
        )}

        {/* Revenue tab */}
        {tab === 'revenue' && (
          summaryLoading
            ? <p className="text-slate-500 text-sm">Loading…</p>
            : summary && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Total Bookings', value: String(summary.total_bookings), color: 'bg-slate-50 border-slate-200 text-slate-700' },
                    { label: 'Gross Revenue',  value: formatVND(summary.total_revenue),       color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { label: 'Commission',     value: formatVND(Number(summary.total_revenue) - Number(summary.total_net_revenue)), color: 'bg-orange-50 border-orange-200 text-orange-700' },
                    { label: 'Net Revenue',    value: formatVND(summary.total_net_revenue),   color: 'bg-green-50 border-green-200 text-green-700' },
                    { label: 'Collected',      value: `${formatVND(summary.total_collected)} (${collectionRate}%)`, color: 'bg-teal-50 border-teal-200 text-teal-700' },
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
                          {['Source', 'Bookings', 'Gross Revenue', 'Commission', 'Net Revenue', 'Collected', 'Outstanding'].map((h) => (
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
                  <p className="text-slate-400 text-sm mb-6">No bookings in this date range.</p>
                )}

                {/* Payment method breakdown */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Collected by Payment Method</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Cash',          value: summary.by_payment_method.cash,         color: 'text-green-700' },
                      { label: 'Bank Transfer', value: summary.by_payment_method.bank_transfer, color: 'text-blue-700' },
                      { label: 'OTA Collected', value: summary.by_payment_method.ota_collected, color: 'text-purple-700' },
                      { label: 'Total',         value: summary.by_payment_method.total,         color: 'text-slate-800' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="border border-gray-100 rounded-lg p-3">
                        <p className={`text-base font-bold ${color}`}>{formatVND(value)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
        )}

        {/* Expenses tab */}
        {tab === 'expenses' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-600">
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                {expenses.length > 0 && ` · Total: ${formatVND(totalExpenses)}`}
              </h2>
              <button
                onClick={() => setShowExpenseForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                + Add Expense
              </button>
            </div>

            {expensesLoading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : expenses.length === 0 ? (
              <p className="text-slate-400 text-sm">No expenses in this date range.</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr>
                      {['Date', 'Category', 'Description', 'Amount', 'Recorded By'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{e.expense_date}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {CATEGORY_LABEL[e.category]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{e.description ?? '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{formatVND(e.amount)}</td>
                        <td className="px-4 py-3 text-slate-500">{e.recorded_by_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* P&L summary — only when revenue summary is also loaded */}
            {summary && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">P&L Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gross Revenue</span>
                    <span className="font-semibold text-slate-800">{formatVND(grossRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Expenses</span>
                    <span className="font-semibold text-red-600">− {formatVND(totalExpenses)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span className="text-slate-700">Net Operating Income</span>
                    <span className={netOperating >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {netOperating >= 0 ? '' : '− '}{formatVND(Math.abs(netOperating))}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">Load Revenue tab first for the gross figure to appear here.</p>
              </div>
            )}
          </>
        )}
      </div>

      {showExpenseForm && (
        <AddExpenseModal
          onClose={() => setShowExpenseForm(false)}
          onCreated={(expense) => {
            setExpenses((prev) => [expense, ...prev])
            setShowExpenseForm(false)
          }}
        />
      )}
    </Layout>
  )
}
