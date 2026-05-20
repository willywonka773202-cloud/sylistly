'use client'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/bertos/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default:
          'bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.98] shadow-[0_0_20px_rgba(139,92,246,0.3)]',
        secondary:
          'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/50',
        ghost:
          'text-zinc-400 hover:text-zinc-100 hover:bg-white/5',
        destructive:
          'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/20',
        outline:
          'border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100',
        glow:
          'bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500 shadow-[0_0_30px_rgba(139,92,246,0.4)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7',
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
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
