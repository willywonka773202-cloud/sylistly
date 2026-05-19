'use client'
import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { RightPanel } from './RightPanel'
import { CommandPalette } from '../command/CommandPalette'
import { useUIStore } from '@/store/bertos/ui'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/bertos/cn'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { rightPanelOpen, setCommandPaletteOpen } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandPaletteOpen])

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen bg-[#0A0A0B] overflow-hidden text-zinc-100">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>

        {/* Right panel */}
        <AnimatePresence>
          {rightPanelOpen && <RightPanel />}
        </AnimatePresence>

        {/* Command palette */}
        <CommandPalette />

        {/* Toast notifications */}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181B',
              border: '1px solid #27272A',
              color: '#F4F4F5',
            },
          }}
        />
      </div>
    </TooltipProvider>
  )
}
