'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Key } from 'lucide-react'
import { useUIStore } from '@/store/bertos/ui'
import { useRouter } from 'next/navigation'

type HealthStatus = { claude: boolean; codex: boolean; gemini: boolean; ollama: boolean }

const OLLAMA_MODELS = new Set(['llama3.2', 'mistral', 'deepseek-coder'])

function isModelConfigured(
  model: string,
  health: HealthStatus,
  apiKeys: Record<string, string | undefined>,
): boolean {
  if (OLLAMA_MODELS.has(model)) return health.ollama || !!apiKeys.ollama
  if (model === 'claude')       return health.claude || !!apiKeys.anthropic
  if (model === 'codex')        return health.codex  || !!apiKeys.openai
  if (model === 'gemini')       return health.gemini || !!apiKeys.google
  // 'auto' — configured if any provider is available
  return health.claude || health.codex || health.gemini || health.ollama ||
    !!apiKeys.anthropic || !!apiKeys.openai || !!apiKeys.google || !!apiKeys.ollama
}

const PROVIDER_LABEL: Record<string, string> = {
  'llama3.2':       'Ollama Cloud',
  mistral:          'Ollama Cloud',
  'deepseek-coder': 'Ollama Cloud',
  claude:           'Anthropic',
  codex:            'OpenAI',
  gemini:           'Google AI',
  auto:             'any AI provider',
}

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const { settings, selectedModel, setActiveView } = useUIStore()
  const router = useRouter()

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json() as Promise<HealthStatus>)
      .then(setHealth)
      .catch(() => setHealth({ claude: false, codex: false, gemini: false, ollama: false }))
  }, [])

  // Don't render until health check resolves (avoids flash)
  if (health === null || dismissed) return null

  const configured = isModelConfigured(
    selectedModel,
    health,
    settings.apiKeys as Record<string, string | undefined>,
  )
  if (configured) return null

  const providerLabel = PROVIDER_LABEL[selectedModel] ?? 'AI provider'

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
              <span className="font-semibold">No API key for {providerLabel}</span>
              {' — '}Add it in Settings or set the matching Vercel environment variable.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setActiveView('settings'); router.push('/settings') }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors px-2.5 py-1 rounded-lg border border-amber-700/40 hover:border-amber-600/60 bg-amber-900/30 hover:bg-amber-900/50"
            >
              <Key className="w-3 h-3" />
              Add Key
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
