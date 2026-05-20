'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { RightPanel } from './RightPanel'
import { BottomNav } from './BottomNav'
import { CommandPalette } from '../command/CommandPalette'
import { OnboardingModal, useOnboarding } from './OnboardingModal'
import { DemoBanner } from './DemoBanner'
import { KeyboardShortcuts } from '../panels/KeyboardShortcuts'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { rightPanelOpen, setRightPanelOpen, sidebarCollapsed, setSidebarCollapsed,
          setCommandPaletteOpen, setActiveView } = useUIStore()
  const { createSession } = useChatStore()
  const { showOnboarding, complete } = useOnboarding()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true) }
      if (mod && e.key === 'b') { e.preventDefault(); setSidebarCollapsed(!sidebarCollapsed) }
      if (mod && e.key === 'p') { e.preventDefault(); setRightPanelOpen(!rightPanelOpen) }
      if (mod && e.key === 'n') { e.preventDefault(); createSession(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === ',') { e.preventDefault(); setActiveView('settings'); router.push('/settings') }
      if (mod && e.key === '0') { e.preventDefault(); setActiveView('dashboard'); router.push('/dashboard') }
      if (mod && e.key === '1') { e.preventDefault(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === '2') { e.preventDefault(); setActiveView('compare'); router.push('/compare') }
      if (mod && e.key === '3') { e.preventDefault(); setActiveView('workspace'); router.push('/workspace') }
      if (mod && e.key === '?') { e.preventDefault(); setShortcutsOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarCollapsed, rightPanelOpen, setCommandPaletteOpen, setSidebarCollapsed,
      setRightPanelOpen, createSession, setActiveView, router])

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-dvh bg-[#0A0A0B] overflow-hidden text-zinc-100">

        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-shrink-0 h-full">
          <Sidebar />
        </div>

        {/* Mobile sidebar — Sheet drawer */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="md:hidden p-0">
            <Sidebar isMobile onMobileClose={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DemoBanner />
          <TopBar onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>

        {/* Right panel — desktop only */}
        <AnimatePresence>
          {rightPanelOpen && (
            <div className="hidden md:block">
              <RightPanel />
            </div>
          )}
        </AnimatePresence>

        {/* Mobile bottom navigation */}
        <BottomNav />

        {/* Overlays */}
        <CommandPalette />
        <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

        <AnimatePresence>
          {showOnboarding && <OnboardingModal onComplete={complete} />}
        </AnimatePresence>

        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181B',
              border: '1px solid #27272A',
              color: '#F4F4F5',
              borderRadius: '12px',
            },
          }}
        />
      </div>
    </TooltipProvider>
  )
}
