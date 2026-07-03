import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import AddExpenseModal from '../../components/expenses/AddExpenseModal'
import Layout from '../../components/layout/Layout'
import { expensesApi, revenueApi } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import type { Expense, MonthlyRevenue } from '../../types'
import { formatVND } from '../../utils/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function DeleteConfirmDialog({ expense, onConfirm, onCancel }: { expense: Expense; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-sm" showClose={false}>
        <DialogHeader>
          <DialogTitle>{t('revenue.expenses.deleteDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('revenue.expenses.deleteDialog.message', {
              amount: formatVND(expense.amount),
              category: expense.category,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="destructive" size="lg" onClick={onConfirm}>{t('revenue.expenses.deleteDialog.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Tab = 'revenue' | 'expenses'

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
  BALCONY:    'bg-emerald-100 text-emerald-800',
  REGULAR:    'bg-muted text-muted-foreground',
  UNASSIGNED: 'bg-orange-100 text-orange-800',
}

export default function RevenuePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const isAdminOrAbove = user?.role === 'OWNER' || user?.role === 'ADMIN'

  // OWNER: revenue + expenses  |  ADMIN: expenses only (the daily arrivals/departures
  // view already lives on the Dashboard and the richer End-of-Day report, so this page
  // no longer duplicates it)
  const visibleTabs: Tab[] = isOwner ? ['revenue', 'expenses'] : ['expenses']

  const [tab, setTab] = useState<Tab>(isOwner ? 'revenue' : 'expenses')

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
    if (tab === 'revenue') loadSummary()
    if (tab === 'expenses') {
      loadExpenses()
      if (isOwner) loadSummary()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="mx-auto max-w-6xl p-4 md:p-8 print:p-4">
        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('revenue.title')}</h1>
        </div>

        {/* Tabs */}
        {visibleTabs.length > 1 && (
          <div className="mb-6 inline-flex w-fit gap-1 rounded-lg bg-muted p-1 print:hidden">
            {visibleTabs.map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => switchTab(tabKey)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  tab === tabKey ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tabKey === 'revenue' ? t('revenue.tabs.revenue') : t('revenue.tabs.expenses')}
              </button>
            ))}
          </div>
        )}

        {/* Date range picker */}
        {(tab === 'revenue' || tab === 'expenses') && (
          <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t('revenue.dateRange.from')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-auto" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t('revenue.dateRange.to')}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-auto" />
            </div>
            <Button onClick={applyRange}>{t('revenue.dateRange.apply')}</Button>
            {tab === 'revenue' && summary && (
              <Button variant="outline" onClick={handleDownloadCSV} className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                <Download className="h-4 w-4" /> Tải CSV
              </Button>
            )}
          </div>
        )}

        {/* Revenue tab */}
        {tab === 'revenue' && (
          summaryLoading
            ? <p className="text-sm text-muted-foreground">{t('bookings.loading')}</p>
            : summary && (
              <>
                {/* Summary cards */}
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  {[
                    { label: t('revenue.summary.totalBookings'), value: String(summary.total_bookings), color: 'bg-muted/50 border-border text-foreground' },
                    { label: t('revenue.occupancyRate'),          value: `${occupancyPct}%`,             color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                    { label: t('revenue.summary.grossRevenue'),   value: formatVND(summary.total_revenue),       color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { label: t('revenue.bySource.commission'),    value: formatVND(Number(summary.total_revenue) - Number(summary.total_net_revenue)), color: 'bg-orange-50 border-orange-200 text-orange-700' },
                    { label: t('revenue.summary.netRevenue'),     value: formatVND(summary.total_net_revenue),   color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                    { label: t('revenue.summary.collected'),      value: `${formatVND(summary.total_collected)} (${collectionRate}%)`, color: 'bg-teal-50 border-teal-200 text-teal-700' },
                    ...(Number(summary.bike_revenue) > 0 ? [
                      { label: '🏍️ Doanh thu xe máy',  value: formatVND(summary.bike_revenue),    color: 'bg-purple-50 border-purple-200 text-purple-700' },
                      { label: '🏍️ Xe máy đã thu',     value: formatVND(summary.bike_collected),  color: 'bg-violet-50 border-violet-200 text-violet-700' },
                      ...(Number(summary.bike_outstanding) > 0
                        ? [{ label: '🏍️ Xe máy còn lại', value: formatVND(summary.bike_outstanding), color: 'bg-red-50 border-red-200 text-red-700' }]
                        : [{ label: '🏍️ Xe máy đã đủ',   value: '✓ Đủ',                             color: 'bg-emerald-50 border-emerald-200 text-emerald-700' }]),
                    ] : []),
                  ].map(({ label, value, color }) => (
                    <div key={label} className={cn('rounded-xl border p-4', color)}>
                      <p className="text-lg font-bold">{value}</p>
                      <p className="mt-1 text-xs font-medium opacity-70">{label}</p>
                    </div>
                  ))}
                </div>

                {/* By-source table */}
                {summary.by_source.length > 0 ? (
                  <div className="mb-6 overflow-hidden rounded-xl border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          {[
                            t('revenue.bySource.source'),
                            t('revenue.bySource.bookings'),
                            t('revenue.bySource.gross'),
                            t('revenue.bySource.commission'),
                            t('revenue.bySource.net'),
                            t('revenue.bySource.collected'),
                            t('revenue.summary.outstanding'),
                          ].map((h) => (
                            <TableHead key={h} className="whitespace-nowrap uppercase tracking-wide">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.by_source.map((row) => {
                          const commission = Number(row.revenue) * Number(row.commission_rate)
                          const outstanding = Number(row.revenue) - Number(row.collected)
                          return (
                            <TableRow key={row.source}>
                              <TableCell className="font-semibold text-foreground">{row.source}</TableCell>
                              <TableCell className="text-muted-foreground">{row.bookings}</TableCell>
                              <TableCell className="text-foreground">{formatVND(row.revenue)}</TableCell>
                              <TableCell className="text-orange-600">
                                {Number(row.commission_rate) > 0
                                  ? `${formatVND(commission)} (${Math.round(Number(row.commission_rate) * 100)}%)`
                                  : '—'}
                              </TableCell>
                              <TableCell className="font-semibold text-foreground">{formatVND(row.net_revenue)}</TableCell>
                              <TableCell className="text-emerald-700">{formatVND(row.collected)}</TableCell>
                              <TableCell className={outstanding > 0 ? 'font-semibold text-red-600' : 'text-muted-foreground'}>
                                {outstanding > 0 ? formatVND(outstanding) : '✓'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="mb-6 text-sm text-muted-foreground">{t('revenue.noData')}</p>
                )}

                {/* By room type table */}
                {summary.by_room_type.length > 0 && (
                  <div className="mb-6 overflow-hidden rounded-xl border bg-card">
                    <div className="border-b px-4 py-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('revenue.byRoomType.title')}</h3>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          {[
                            t('revenue.byRoomType.roomType'),
                            t('revenue.byRoomType.bookings'),
                            t('revenue.byRoomType.nights'),
                            t('revenue.byRoomType.gross'),
                            t('revenue.byRoomType.net'),
                          ].map((h) => (
                            <TableHead key={h} className="whitespace-nowrap uppercase tracking-wide">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.by_room_type.map((row) => (
                          <TableRow key={row.room_type}>
                            <TableCell>
                              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', ROOM_TYPE_COLORS[row.room_type] ?? 'bg-muted text-muted-foreground')}>
                                {row.room_type === 'UNASSIGNED' ? t('revenue.byRoomType.UNASSIGNED') : t(`roomType.${row.room_type}` as any)}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{row.bookings}</TableCell>
                            <TableCell className="text-muted-foreground">{row.nights}</TableCell>
                            <TableCell className="text-foreground">{formatVND(row.revenue)}</TableCell>
                            <TableCell className="font-semibold text-foreground">{formatVND(row.net_revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Payment method breakdown */}
                <div className="mb-6 rounded-xl border bg-card p-5">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('revenue.byPayment.title')}</h3>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      { label: t('revenue.byPayment.cash'),         value: summary.by_payment_method.cash,         color: 'text-emerald-700' },
                      { label: t('revenue.byPayment.bankTransfer'), value: summary.by_payment_method.bank_transfer, color: 'text-blue-700' },
                      { label: t('revenue.byPayment.ota'),          value: summary.by_payment_method.ota_collected, color: 'text-purple-700' },
                      { label: t('revenue.byPayment.total'),        value: summary.by_payment_method.total,         color: 'text-foreground' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-lg border p-3">
                        <p className={cn('text-base font-bold', color)}>{formatVND(value)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tax report — admin/owner only */}
                {isAdminOrAbove && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-amber-900">{t('revenue.taxReport.title')}</h3>
                        <p className="mt-0.5 text-xs text-amber-700">{t('revenue.taxReport.note')}</p>
                      </div>
                      <Button onClick={handlePrint} size="sm" className="bg-amber-700 text-white hover:bg-amber-800 print:hidden">
                        {t('revenue.taxReport.print')}
                      </Button>
                    </div>
                    <div className="space-y-2 rounded-lg bg-card p-4 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('revenue.taxReport.period')}</span>
                        <span className="font-medium text-foreground">{summary.start_date} → {summary.end_date}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('revenue.taxReport.occupancyRate')}</span>
                        <span className="font-medium text-foreground">{occupancyPct}%</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('revenue.taxReport.grossRevenue')}</span>
                        <span className="font-semibold text-foreground">{formatVND(summary.total_revenue)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{t('revenue.taxReport.otaCommission')}</span>
                        <span className="font-semibold text-orange-700">− {formatVND(Number(summary.total_revenue) - Number(summary.total_net_revenue))}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-semibold text-foreground">
                        <span>{t('revenue.taxReport.netRevenue')}</span>
                        <span>{formatVND(summary.total_net_revenue)}</span>
                      </div>
                      {totalExpenses > 0 && (
                        <>
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t('revenue.taxReport.totalExpenses')}</span>
                            <span className="font-semibold text-red-600">− {formatVND(totalExpenses)}</span>
                          </div>
                          <div className={cn('flex justify-between border-t pt-2 font-bold', netOperating >= 0 ? 'text-emerald-700' : 'text-red-600')}>
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t('revenue.expenses.count', { count: expenses.length })}
                {expenses.length > 0 && ` · ${formatVND(totalExpenses)}`}
              </h2>
              <Button onClick={() => setShowExpenseForm(true)}>{t('revenue.expenses.addExpense')}</Button>
            </div>

            {expensesLoading ? (
              <p className="text-sm text-muted-foreground">{t('bookings.loading')}</p>
            ) : expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('revenue.expenses.noExpenses')}</p>
            ) : (
              <div className="mb-6 overflow-hidden rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {[
                        t('revenue.expenses.table.date'),
                        t('revenue.expenses.table.category'),
                        t('revenue.expenses.table.description'),
                        t('revenue.expenses.table.amount'),
                        t('revenue.expenses.table.recordedBy'),
                        '',
                      ].map((h, i) => (
                        <TableHead key={i} className="whitespace-nowrap uppercase tracking-wide">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{e.expense_date}</TableCell>
                        <TableCell>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                            {t(`expenseCategory.${e.category}` as any)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{e.description ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-foreground">{formatVND(e.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{e.recorded_by_name ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => setEditingExpense(e)}>
                              {t('common.edit')}
                            </Button>
                            {isAdminOrAbove && (
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialog(e)}>
                                {t('common.delete')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {summary && (
              <div className="rounded-xl border bg-card p-5">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('revenue.expenses.pl.title')}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('revenue.expenses.pl.grossRevenue')}</span>
                    <span className="font-semibold text-foreground">{formatVND(netRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('revenue.expenses.pl.totalExpenses')}</span>
                    <span className="font-semibold text-red-600">− {formatVND(totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span className="text-foreground">{t('revenue.expenses.pl.net')}</span>
                    <span className={netOperating >= 0 ? 'text-emerald-600' : 'text-red-600'}>
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
