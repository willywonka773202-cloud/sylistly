'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { section: 'Navigation', items: [
    { keys: ['⌘', 'K'], label: 'Open command palette' },
    { keys: ['⌘', '1'], label: 'Go to Chat' },
    { keys: ['⌘', '2'], label: 'Go to Compare' },
    { keys: ['⌘', '3'], label: 'Go to Workspace' },
  ]},
  { section: 'Chat', items: [
    { keys: ['↵'], label: 'Send message' },
    { keys: ['⇧', '↵'], label: 'New line' },
    { keys: ['/'], label: 'Slash commands' },
    { keys: ['Esc'], label: 'Stop generation' },
  ]},
  { section: 'Interface', items: [
    { keys: ['⌘', 'B'], label: 'Toggle sidebar' },
    { keys: ['⌘', 'P'], label: 'Toggle right panel' },
    { keys: ['⌘', 'N'], label: 'New chat' },
    { keys: ['⌘', ','], label: 'Settings' },
  ]},
]

interface KeyboardShortcutsProps {
  open: boolean
  onClose: () => void
}

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="pointer-events-auto w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <Keyboard className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-zinc-200">Keyboard Shortcuts</span>
                </div>
                <button onClick={onClose} className="p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {SHORTCUTS.map(section => (
                  <div key={section.section}>
                    <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">{section.section}</p>
                    <div className="space-y-1.5">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400">{item.label}</span>
                          <div className="flex items-center gap-1">
                            {item.keys.map((key, j) => (
                              <kbd key={j} className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-300 font-mono font-medium">
                                {key}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
