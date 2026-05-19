'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Cpu, Globe, Sparkles, ChevronDown, PanelRight, PanelRightClose, Command, Bot, Menu } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import type { AIModel } from '@/lib/bertos/types'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type ModelOption = { value: AIModel; label: string; description: string; icon: React.ReactNode; color: string }

const CLOUD_MODELS: ModelOption[] = [
  { value: 'auto',   label: 'Auto',   description: 'Intelligent routing',         icon: <Sparkles className="w-3.5 h-3.5" />, color: '#F59E0B' },
  { value: 'claude', label: 'Claude', description: 'Anthropic · Best for reasoning', icon: <Cpu className="w-3.5 h-3.5" />,      color: '#8B5CF6' },
  { value: 'codex',  label: 'Codex',  description: 'OpenAI · Best for coding',    icon: <Zap className="w-3.5 h-3.5" />,      color: '#10B981' },
  { value: 'gemini', label: 'Gemini', description: 'Google · Best for research',  icon: <Globe className="w-3.5 h-3.5" />,    color: '#3B82F6' },
]

const OLLAMA_MODELS: ModelOption[] = [
  { value: 'llama3.2',       label: 'Llama 3.2',       description: 'Meta · Ollama Cloud',     icon: <Bot className="w-3.5 h-3.5" />, color: '#F97316' },
  { value: 'mistral',        label: 'Mistral',          description: 'Mistral AI · Ollama Cloud', icon: <Bot className="w-3.5 h-3.5" />, color: '#EC4899' },
  { value: 'deepseek-coder', label: 'DeepSeek Coder',  description: 'DeepSeek · Ollama Cloud', icon: <Bot className="w-3.5 h-3.5" />, color: '#06B6D4' },
]

const ALL_MODEL_OPTIONS: ModelOption[] = [...CLOUD_MODELS, ...OLLAMA_MODELS]

export function TopBar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { selectedModel, setSelectedModel, activeView, rightPanelOpen, setRightPanelOpen, setCommandPaletteOpen } = useUIStore()
  const { isStreaming } = useChatStore()
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  const activeModel = ALL_MODEL_OPTIONS.find(m => m.value === selectedModel) ?? ALL_MODEL_OPTIONS[0]

  const viewLabels: Record<string, string> = {
    chat: 'Chat',
    compare: 'Multi-AI Compare',
    workspace: 'Coding Workspace',
    agents: 'Agent Tasks',
    memory: 'Project Memory',
    settings: 'Settings',
  }

  return (
    <div className="relative flex items-center gap-3 px-4 h-12 border-b border-zinc-800/50 bg-[#0A0A0B]/80 backdrop-blur-sm flex-shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMobileMenuToggle}
        className="md:hidden flex-shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>
      {/* View title */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm font-semibold text-zinc-200">
          {viewLabels[activeView] ?? 'BertOS'}
        </span>
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5"
            >
              <div className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [1, 2.5, 1] }}
                    transition={{ duration: 0.6, delay: i * 0.12, repeat: Infinity }}
                    className="w-0.5 h-2.5 rounded-full bg-violet-400 origin-bottom"
                  />
                ))}
              </div>
              <span className="text-xs text-violet-400">Generating</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Command palette hint */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-all text-zinc-600 hover:text-zinc-400"
          >
            <Command className="w-3 h-3" />
            <span className="text-[10px]">⌘K</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Command Palette</TooltipContent>
      </Tooltip>

      {/* Model selector */}
      <div className="relative">
        <button
          onClick={() => setModelMenuOpen(!modelMenuOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-150 text-sm"
        >
          <span style={{ color: activeModel.color }}>{activeModel.icon}</span>
          <span className="text-zinc-200 font-medium text-xs">{activeModel.label}</span>
          <ChevronDown className={cn('w-3 h-3 text-zinc-500 transition-transform duration-150', modelMenuOpen && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {modelMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden z-50"
              >
                <div className="p-1.5 space-y-0.5">
                  <p className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                    Cloud Models
                  </p>
                  {CLOUD_MODELS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => { setSelectedModel(option.value); setModelMenuOpen(false) }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-100',
                        selectedModel === option.value
                          ? 'bg-white/10 text-zinc-100'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                      )}
                    >
                      <span style={{ color: option.color }}>{option.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{option.label}</p>
                        <p className="text-[10px] text-zinc-600 truncate">{option.description}</p>
                      </div>
                      {selectedModel === option.value && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: option.color }} />
                      )}
                    </button>
                  ))}

                  <div className="my-1 border-t border-zinc-800/80" />
                  <p className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                    Open Source · Ollama Cloud
                  </p>
                  {OLLAMA_MODELS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => { setSelectedModel(option.value); setModelMenuOpen(false) }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-100',
                        selectedModel === option.value
                          ? 'bg-white/10 text-zinc-100'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                      )}
                    >
                      <span style={{ color: option.color }}>{option.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{option.label}</p>
                        <p className="text-[10px] text-zinc-600 truncate">{option.description}</p>
                      </div>
                      {selectedModel === option.value && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: option.color }} />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Live indicator */}
      <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/50 border border-zinc-800/50">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] text-zinc-500">Live</span>
      </div>

      {/* Right panel toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={cn(
              'p-1.5 rounded-lg border transition-all duration-150',
              rightPanelOpen
                ? 'border-violet-500/30 bg-violet-500/10 text-violet-400'
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700'
            )}
          >
            {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{rightPanelOpen ? 'Hide Panel' : 'Show Panel'}</TooltipContent>
      </Tooltip>
    </div>
  )
}
