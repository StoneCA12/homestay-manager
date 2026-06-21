export function formatVND(amount: string | number): string {
  return new Intl.NumberFormat('vi-VN').format(Number(amount)) + ' ₫'
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
