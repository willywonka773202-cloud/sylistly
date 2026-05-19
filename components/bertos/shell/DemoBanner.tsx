'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Key } from 'lucide-react'
import { useUIStore } from '@/store/bertos/ui'
import { useRouter } from 'next/navigation'

type HealthStatus = {
  'claude-code': boolean
  'gemini-cli':  boolean
  'codex-cli':   boolean
  'claude-api':  boolean
  'openai-api':  boolean
  'gemini-api':  boolean
  enableApiProviders: boolean
}

// Models that are always-on and require no separate configuration
const ALWAYS_ON = new Set(['auto', 'ollama-pro', 'qwen2.5-coder', 'llama3', 'llama3.2', 'mistral', 'deepseek-coder', 'hermes3'])

// CLI models — available once the local CLI tool is installed
const CLI_MODELS = new Set(['claude-code', 'gemini-cli', 'codex-cli'])

// API models — require API key + enableApiProviders
const API_MODELS = new Set(['claude-api', 'openai-api', 'gemini-api'])

function isModelConfigured(
  model: string,
  health: HealthStatus,
  apiKeys: Record<string, string | undefined>,
  enableApiProviders: boolean,
): boolean {
  if (ALWAYS_ON.has(model))  return true
  if (CLI_MODELS.has(model)) return health[model as keyof typeof health] as boolean || false
  if (model === 'claude-api') return enableApiProviders && (health['claude-api'] || !!apiKeys.anthropic)
  if (model === 'openai-api') return enableApiProviders && (health['openai-api'] || !!apiKeys.openai)
  if (model === 'gemini-api') return enableApiProviders && (health['gemini-api'] || !!apiKeys.google)
  return false
}

const PROVIDER_LABEL: Record<string, string> = {
  'claude-code': 'Claude Code CLI',
  'gemini-cli':  'Gemini CLI',
  'codex-cli':   'Codex CLI',
  'claude-api':  'Anthropic API',
  'openai-api':  'OpenAI API',
  'gemini-api':  'Gemini API',
}

function getBannerMessage(model: string, enableApiProviders: boolean): { title: string; body: string } {
  if (CLI_MODELS.has(model)) {
    const cmds: Record<string, string> = {
      'claude-code': 'npm install -g @anthropic-ai/claude-code && claude login',
      'gemini-cli':  'npm install -g @google/gemini-cli && gemini auth login',
      'codex-cli':   'npm install -g @openai/codex && codex login',
    }
    return {
      title: `${PROVIDER_LABEL[model]} not detected`,
      body: `Install locally: ${cmds[model] ?? ''}`,
    }
  }
  if (API_MODELS.has(model)) {
    if (!enableApiProviders) {
      return {
        title: `API providers are disabled`,
        body: `Enable in Settings → Providers. Note: ${PROVIDER_LABEL[model]} creates a separate API bill.`,
      }
    }
    return {
      title: `No API key for ${PROVIDER_LABEL[model]}`,
      body: `Add it in Settings → API Keys or set the matching environment variable.`,
    }
  }
  return { title: 'Provider not configured', body: 'Check Settings to configure this provider.' }
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
      .catch(() => setHealth({
        'claude-code': false, 'gemini-cli': false, 'codex-cli': false,
        'claude-api': false, 'openai-api': false, 'gemini-api': false,
        enableApiProviders: false,
      }))
  }, [])

  if (health === null || dismissed) return null

  const enableApiProviders = settings.enableApiProviders ?? health.enableApiProviders ?? false
  const configured = isModelConfigured(
    selectedModel,
    health,
    settings.apiKeys as Record<string, string | undefined>,
    enableApiProviders,
  )
  if (configured) return null

  const { title, body } = getBannerMessage(selectedModel, enableApiProviders)

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
              <span className="font-semibold">{title}</span>{' — '}{body}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setActiveView('settings'); router.push('/settings') }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300 hover:text-amber-200 transition-colors px-2.5 py-1 rounded-lg border border-amber-700/40 hover:border-amber-600/60 bg-amber-900/30 hover:bg-amber-900/50"
            >
              <Key className="w-3 h-3" />
              Settings
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
