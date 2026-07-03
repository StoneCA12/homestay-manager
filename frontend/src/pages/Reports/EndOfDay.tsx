import { useEffect, useState } from 'react'
import { Printer, RefreshCw } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import { reportsApi } from '../../services/api'
import { formatVND, toLocalISODate } from '../../utils/format'
import type {
  EndOfDayReport, EodBookingRow, EodOutstanding, EodPaymentRow,
} from '../../types'

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function today() {
  return toLocalISODate(new Date())
}

// ── Sub-components (module level) ─────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
      {count !== undefined && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">{count}</span>
      )}
    </h2>
  )
}

function BookingTable({ rows, emptyText }: { rows: EodBookingRow[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1.5 font-semibold">Phòng</th>
            <th className="py-1.5 font-semibold">Khách</th>
            <th className="py-1.5 font-semibold">Nhận</th>
            <th className="py-1.5 font-semibold">Trả</th>
            <th className="py-1.5 text-right font-semibold">Tổng</th>
            <th className="py-1.5 text-right font-semibold">Đã thu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 font-medium">{r.room_number ? `P.${r.room_number}` : '—'}</td>
              <td className="py-1.5">{r.guest_name}</td>
              <td className="py-1.5 text-muted-foreground">{fmtDate(r.check_in_date)}</td>
              <td className="py-1.5 text-muted-foreground">{fmtDate(r.check_out_date)}</td>
              <td className="py-1.5 text-right">{formatVND(r.total_price)}</td>
              <td className="py-1.5 text-right">{formatVND(r.collected_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PaymentsTable({ rows }: { rows: EodPaymentRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Không có thanh toán nào hôm nay.</p>

  const METHOD_LABEL: Record<string, string> = {
    CASH: 'Tiền mặt',
    BANK_TRANSFER: 'Chuyển khoản',
    OTA_COLLECTED: 'OTA thu',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1.5 font-semibold">Thời gian</th>
            <th className="py-1.5 font-semibold">Khách</th>
            <th className="py-1.5 font-semibold">Phòng</th>
            <th className="py-1.5 font-semibold">Phương thức</th>
            <th className="py-1.5 text-right font-semibold">Số tiền</th>
            <th className="py-1.5 font-semibold">Người ghi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 text-muted-foreground">{fmtDateTime(p.paid_at)}</td>
              <td className="py-1.5">{p.guest_name}</td>
              <td className="py-1.5">{p.room_number ? `P.${p.room_number}` : '—'}</td>
              <td className="py-1.5">{METHOD_LABEL[p.method] ?? p.method}</td>
              <td className={`py-1.5 text-right font-medium ${Number(p.amount) < 0 ? 'text-destructive' : ''}`}>
                {Number(p.amount) < 0 ? '↩ ' : ''}{formatVND(p.amount)}
              </td>
              <td className="py-1.5 text-muted-foreground">{p.recorded_by ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OutstandingTable({ rows }: { rows: EodOutstanding[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Không có khách nào còn nợ.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-1.5 font-semibold">Phòng</th>
            <th className="py-1.5 font-semibold">Khách</th>
            <th className="py-1.5 font-semibold">Trả phòng</th>
            <th className="py-1.5 text-right font-semibold">Còn nợ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.booking_id} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 font-medium">{r.room_number ? `P.${r.room_number}` : '—'}</td>
              <td className="py-1.5">{r.guest_name}</td>
              <td className="py-1.5 text-muted-foreground">{fmtDate(r.check_out_date)}</td>
              <td className="py-1.5 text-right font-semibold text-destructive">{formatVND(r.outstanding)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function EndOfDayPage() {
  const [selectedDate, setSelectedDate] = useState(today())
  const [report, setReport] = useState<EndOfDayReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchReport = async (d: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await reportsApi.endOfDay(d)
      setReport(data)
    } catch {
      setError('Không thể tải báo cáo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(selectedDate)
  }, [selectedDate])

  const arrivals = report
    ? [...report.arrivals_on_time, ...report.arrivals_late]
    : []
  const departures = report
    ? [...report.departures_on_time, ...report.departures_late]
    : []

  return (
    <Layout>
      <div className="mx-auto max-w-4xl p-4 md:p-8 print:p-0 print:max-w-none">

        {/* ── Header ── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Báo cáo cuối ngày</h1>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => fetchReport(selectedDate)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tải lại
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Printer className="h-3.5 w-3.5" />
              In / PDF
            </button>
          </div>
        </div>

        {/* Print-only header */}
        <div className="hidden print:block mb-6 border-b border-border pb-4">
          <h1 className="text-2xl font-bold">Báo cáo cuối ngày</h1>
          <p className="text-sm text-muted-foreground">
            Ngày: {report ? fmtDate(report.report_date) : fmtDate(selectedDate)}
            {report?.is_snapshot && ' · Bản lưu'}
          </p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Đang tải...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {report && (
          <div className="space-y-4">

            {/* ── Snapshot notice + meta ── */}
            {report.is_snapshot && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
                Đây là bản lưu từ {fmtDateTime(report.generated_at)}.
              </div>
            )}

            {/* ── Summary row ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Lượt nhận phòng', value: arrivals.length },
                { label: 'Lượt trả phòng', value: departures.length },
                {
                  label: 'Lấp đầy tối nay',
                  value: `${report.occupied_tonight}/${report.total_rooms}`,
                },
                {
                  label: 'Đã thu hôm nay',
                  value: formatVND(report.revenue.total),
                  highlight: true,
                },
              ].map(({ label, value, highlight }) => (
                <Card key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`mt-1 text-xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>
                    {value}
                  </p>
                </Card>
              ))}
            </div>

            {/* ── Outstanding balances (critical — shown near top) ── */}
            {report.outstanding_balances.length > 0 && (
              <Card>
                <SectionHeader title="Khách còn nợ (đang ở)" count={report.outstanding_balances.length} />
                <OutstandingTable rows={report.outstanding_balances} />
              </Card>
            )}

            {/* ── Booking activity ── */}
            <Card>
              <SectionHeader title="Hoạt động đặt phòng" />
              <div className="flex flex-wrap gap-4 text-sm">
                <span>Mới tạo: <strong>{report.bookings_created_count}</strong></span>
                <span>Hủy: <strong>{report.bookings_cancelled_count}</strong></span>
                <span>Sửa đổi: <strong>{report.bookings_modified_count}</strong></span>
              </div>
            </Card>

            {/* ── Arrivals ── */}
            <Card>
              <SectionHeader
                title="Nhận phòng hôm nay"
                count={arrivals.length}
              />
              {arrivals.length > 0 ? (
                <>
                  {report.arrivals_on_time.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-emerald-700">Đúng hạn ({report.arrivals_on_time.length})</p>
                      <BookingTable rows={report.arrivals_on_time} emptyText="" />
                    </div>
                  )}
                  {report.arrivals_late.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-amber-700">Nhận muộn ({report.arrivals_late.length})</p>
                      <BookingTable rows={report.arrivals_late} emptyText="" />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Không có lượt nhận phòng nào.</p>
              )}
              {report.arrivals_no_show.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="mb-1 text-xs font-medium text-red-700">Chưa nhận phòng ({report.arrivals_no_show.length})</p>
                  <BookingTable rows={report.arrivals_no_show} emptyText="" />
                </div>
              )}
            </Card>

            {/* ── Departures ── */}
            <Card>
              <SectionHeader
                title="Trả phòng hôm nay"
                count={departures.length}
              />
              {departures.length > 0 ? (
                <>
                  {report.departures_on_time.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-emerald-700">Đúng hạn ({report.departures_on_time.length})</p>
                      <BookingTable rows={report.departures_on_time} emptyText="" />
                    </div>
                  )}
                  {report.departures_late.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-amber-700">Trả muộn ({report.departures_late.length})</p>
                      <BookingTable rows={report.departures_late} emptyText="" />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Không có lượt trả phòng nào.</p>
              )}
            </Card>

            {/* ── Revenue breakdown ── */}
            <Card>
              <SectionHeader title="Doanh thu thu về hôm nay" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                {[
                  { label: 'Tiền mặt', value: report.revenue.cash },
                  { label: 'Chuyển khoản', value: report.revenue.bank_transfer },
                  { label: 'OTA thu', value: report.revenue.ota_collected },
                  { label: 'Tổng cộng', value: report.revenue.total, bold: true },
                ].map(({ label, value, bold }) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`mt-0.5 ${bold ? 'text-lg font-bold text-primary' : 'font-semibold text-foreground'}`}>
                      {formatVND(value)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Payments list ── */}
            <Card>
              <SectionHeader title="Chi tiết thanh toán" count={report.payments.length} />
              <PaymentsTable rows={report.payments} />
            </Card>

            {/* ── Rooms cleaned ── */}
            <Card>
              <SectionHeader title="Phòng đã dọn" count={report.rooms_cleaned.length} />
              {report.rooms_cleaned.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa ghi nhận phòng nào được dọn.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {report.rooms_cleaned.map((r, i) => (
                    <div key={i} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-emerald-800">P.{r.room_number}</span>
                      {r.cleaned_by && <span className="ml-1 text-emerald-700">· {r.cleaned_by}</span>}
                      <span className="ml-1 text-xs text-emerald-600">{fmtDateTime(r.cleaned_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ── Bike activity ── */}
            {(report.bikes_assigned.length > 0 || report.bikes_returned.length > 0) && (
              <Card>
                <SectionHeader title="Xe máy" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {report.bikes_assigned.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Cho thuê ({report.bikes_assigned.length})</p>
                      <ul className="space-y-1">
                        {report.bikes_assigned.map((b, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">{b.bike_name}</span>
                            {b.plate_number && <span className="text-muted-foreground"> · {b.plate_number}</span>}
                            {b.room_number && <span className="text-muted-foreground"> → P.{b.room_number}</span>}
                            <span className="text-muted-foreground"> ({b.guest_name})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.bikes_returned.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Trả lại ({report.bikes_returned.length})</p>
                      <ul className="space-y-1">
                        {report.bikes_returned.map((b, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">{b.bike_name}</span>
                            {b.plate_number && <span className="text-muted-foreground"> · {b.plate_number}</span>}
                            <span className="text-muted-foreground"> ({b.guest_name})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* ── Occupancy ── */}
            <Card>
              <SectionHeader title="Lấp đầy tối nay" />
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-primary">{report.occupied_tonight}</span>
                <span className="mb-1 text-lg text-muted-foreground">/ {report.total_rooms} phòng</span>
                <span className="mb-1 ml-2 text-lg font-semibold text-foreground">
                  {report.total_rooms > 0
                    ? `${Math.round((report.occupied_tonight / report.total_rooms) * 100)}%`
                    : '—'}
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: report.total_rooms > 0 ? `${(report.occupied_tonight / report.total_rooms) * 100}%` : '0%' }}
                />
              </div>
            </Card>

          </div>
        )}
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body { font-size: 12px; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          button { display: none !important; }
        }
      `}</style>
    </Layout>
  )
}
