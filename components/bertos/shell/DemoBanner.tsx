'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ExternalLink, Key } from 'lucide-react'
import { useUIStore } from '@/store/bertos/ui'
import { useRouter } from 'next/navigation'

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { settings, setActiveView } = useUIStore()
  const router = useRouter()

  const hasApiKey = !!settings.apiKeys.anthropic
  if (hasApiKey || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="flex-shrink-0 overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-950/60 to-orange-950/40 border-b border-amber-800/30">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300/90 truncate">
              <span className="font-semibold">Demo mode</span>
              {' — '}AI responses are simulated. Add your Anthropic API key for real Claude responses.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setActiveView('settings')
                router.push('/settings')
              }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors px-2.5 py-1 rounded-lg border border-amber-700/40 hover:border-amber-600/60 bg-amber-900/30 hover:bg-amber-900/50"
            >
              <Key className="w-3 h-3" />
              Add API Key
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded text-amber-600 hover:text-amber-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
