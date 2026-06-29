import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
  count?: number
}

interface FilterBarProps {
  options: FilterOption[]
  active: ReadonlySet<string>
  onToggle: (value: string) => void
  onClear: () => void
  className?: string
}

export default function FilterBar({ options, active, onToggle, onClear, className }: FilterBarProps) {
  const hasActive = active.size > 0

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {hasActive && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Xóa bộ lọc
        </button>
      )}
      {options.map((opt) => {
        const isActive = active.has(opt.value)
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {opt.label}
            {opt.count !== undefined && opt.count > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                isActive
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}>
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
