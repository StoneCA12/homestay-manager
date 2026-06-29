import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BookingWarning } from '../../lib/bookingWarnings'

interface Props {
  warnings: BookingWarning[]
  className?: string
}

export default function WarningBanner({ warnings, className }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = warnings.filter((w) => !dismissed.has(w.id))
  if (visible.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      {visible.map((w) => (
        <div
          key={w.id}
          className={cn(
            'flex items-start gap-3 rounded-xl border px-3 py-2.5',
            w.severity === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-blue-200 bg-blue-50 text-blue-900',
          )}
        >
          <span className="mt-0.5 text-base leading-none">{w.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-snug">{w.message}</p>
            <p className={cn(
              'mt-0.5 text-[11px] leading-snug',
              w.severity === 'warning' ? 'text-amber-700' : 'text-blue-700',
            )}>
              {w.action}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set([...prev, w.id]))}
            className={cn(
              'mt-0.5 shrink-0 rounded p-0.5 transition-colors',
              w.severity === 'warning'
                ? 'text-amber-500 hover:bg-amber-100 hover:text-amber-700'
                : 'text-blue-500 hover:bg-blue-100 hover:text-blue-700',
            )}
            aria-label="Bỏ qua cảnh báo"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
