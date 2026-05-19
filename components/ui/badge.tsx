import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/bertos/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-zinc-700 bg-zinc-800 text-zinc-300',
        claude: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
        codex: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        gemini: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
        auto: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        error: 'border-red-500/30 bg-red-500/10 text-red-300',
        info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
