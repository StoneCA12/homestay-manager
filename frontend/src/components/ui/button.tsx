import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent text-sm font-medium transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:h-4 [&_svg:not([class*='size-'])]:w-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'hover:bg-muted hover:text-foreground',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      // Sizes are touch-target aware: `lg`/`icon-lg` hit the 44px minimum recommended
      // for phone/tablet (this app's primary device context at the front desk).
      // `xs`/`icon-sm` stay compact and are reserved for dense, desktop-oriented
      // contexts (table row actions, tight inline controls) — not primary actions.
      size: {
        default: 'h-10 px-3',
        xs: 'h-6 gap-1 rounded-md px-2 text-xs',
        sm: 'h-9 gap-1 px-3 text-[0.8rem]',
        lg: 'h-11 px-4',
        icon: 'h-10 w-10',
        'icon-sm': 'h-7 w-7',
        'icon-lg': 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
