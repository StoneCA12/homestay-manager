import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  label: string
}

interface Props {
  steps: Step[]
  currentStep: number // 1-based
}

export default function StepIndicator({ steps, currentStep }: Props) {
  return (
    <div className="flex items-start">
      {steps.map((step, i) => {
        const num = i + 1
        const done = num < currentStep
        const active = num === currentStep
        return (
          <div key={i} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div className={cn('h-px flex-1 transition-colors', done ? 'bg-primary' : 'bg-border')} />
              )}
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  done && 'bg-primary text-primary-foreground',
                  active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  !done && !active && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : num}
              </div>
              {i < steps.length - 1 && (
                <div className={cn('h-px flex-1 transition-colors', done ? 'bg-primary' : 'bg-border')} />
              )}
            </div>
            <span
              className={cn(
                'mt-1.5 hidden text-xs whitespace-nowrap text-center sm:block',
                active ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
