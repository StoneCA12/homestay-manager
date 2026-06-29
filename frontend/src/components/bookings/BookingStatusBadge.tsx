import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  PENDING:     'bg-violet-100 text-violet-700',
  CONFIRMED:   'bg-blue-100 text-blue-700',
  CHECKED_IN:  'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-muted text-muted-foreground',
  CANCELLED:   'bg-red-100 text-red-600',
  NO_SHOW:     'bg-amber-100 text-amber-700',
}

export default function BookingStatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={cn(
      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
      STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground',
      className,
    )}>
      {t(`status.${status}` as any)}
    </span>
  )
}
