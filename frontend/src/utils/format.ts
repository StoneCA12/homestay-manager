export function formatVND(amount: string | number): string {
  return new Intl.NumberFormat('vi-VN').format(Number(amount)) + ' ₫'
}

// Serializes a Date's *local* calendar date as YYYY-MM-DD. Do not use
// `d.toISOString().split('T')[0]` for this — toISOString() converts to UTC first,
// which silently shifts the date back by one day for any UTC+ timezone (e.g. the
// first ~7 hours of each day in Vietnam, and unconditionally for Dates built via
// `new Date(y, m, d)` local-midnight construction).
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
