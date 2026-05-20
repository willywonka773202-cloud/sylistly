'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/bertos/cn'
import { X } from 'lucide-react'
import React from 'react'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close
export const SheetTitle = Dialog.Title
export const SheetDescription = Dialog.Description

export function SheetOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof Dialog.Overlay>) {
  return (
    <Dialog.Overlay
      className={cn(
        'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm',
        'transition-opacity duration-200',
        'data-[state=open]:opacity-100 data-[state=closed]:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  side?: 'left' | 'right'
  showClose?: boolean
}

export function SheetContent({
  children,
  side = 'left',
  showClose = false,
  className,
  ...props
}: SheetContentProps) {
  return (
    <Dialog.Portal>
      <SheetOverlay />
      <Dialog.Content
        className={cn(
          'fixed z-50 inset-y-0 flex flex-col bg-[#0D0D0F] shadow-2xl',
          'transition-transform duration-200 ease-out',
          side === 'left'
            ? 'left-0 w-[280px] border-r border-zinc-800/50 data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0'
            : 'right-0 w-[280px] border-l border-zinc-800/50 data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
          className,
        )}
        {...props}
      >
        {showClose && (
          <Dialog.Close className="absolute right-3 top-3 z-10 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all">
            <X className="w-4 h-4" />
          </Dialog.Close>
        )}
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
