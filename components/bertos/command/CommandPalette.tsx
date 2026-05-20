'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, GitCompare, Code2, Bot, Brain, Settings, Plus,
  Trash2, Cpu, Globe, Zap, Sparkles, Search, ArrowRight, Keyboard
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useRouter } from 'next/navigation'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  category: string
  action: () => void
  keywords: string[]
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveView, setSelectedModel } = useUIStore()
  const { createSession, clearSession, getActiveSession } = useChatStore()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const navigate = (view: 'chat' | 'compare' | 'workspace' | 'agents' | 'memory' | 'settings', href: string) => {
    setActiveView(view)
    router.push(href)
    setCommandPaletteOpen(false)
  }

  const COMMANDS: Command[] = [
    {
      id: 'new-chat',
      label: 'New Chat',
      description: 'Start a fresh conversation',
      icon: <Plus className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['new', 'chat', 'start', 'fresh'],
      action: () => { createSession(); navigate('chat', '/chat') },
    },
    {
      id: 'open-chat',
      label: 'Go to Chat',
      icon: <MessageSquare className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['chat', 'go', 'open'],
      action: () => navigate('chat', '/chat'),
    },
    {
      id: 'open-compare',
      label: 'Multi-AI Compare',
      description: 'Compare responses side-by-side',
      icon: <GitCompare className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['compare', 'side', 'vs', 'versus'],
      action: () => navigate('compare', '/compare'),
    },
    {
      id: 'open-workspace',
      label: 'Coding Workspace',
      description: 'Open the coding environment',
      icon: <Code2 className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['code', 'workspace', 'repo', 'git'],
      action: () => navigate('workspace', '/workspace'),
    },
    {
      id: 'open-agents',
      label: 'Agent Tasks',
      description: 'Manage autonomous AI tasks',
      icon: <Bot className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['agent', 'task', 'autonomous', 'background'],
      action: () => navigate('agents', '/agents'),
    },
    {
      id: 'open-memory',
      label: 'Project Memory',
      description: 'View project context and history',
      icon: <Brain className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['memory', 'project', 'history', 'context'],
      action: () => navigate('memory', '/memory'),
    },
    {
      id: 'open-settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['settings', 'config', 'preferences'],
      action: () => navigate('settings', '/settings'),
    },
    {
      id: 'keyboard-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: <Keyboard className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['keyboard', 'shortcuts', 'hotkeys', 'keybindings'],
      action: () => { setCommandPaletteOpen(false); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', metaKey: true, ctrlKey: false })), 50) },
    },
    {
      id: 'use-ollama-pro',
      label: 'Switch to Ollama Pro',
      description: 'Set Ollama Pro as primary model (default)',
      icon: <Bot className="w-4 h-4 text-orange-400" />,
      category: 'Model',
      keywords: ['ollama', 'pro', 'model', 'default'],
      action: () => { setSelectedModel('ollama-pro'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-claude-code',
      label: 'Switch to Claude Code',
      description: 'Set Claude Code CLI as primary model',
      icon: <Cpu className="w-4 h-4 text-violet-400" />,
      category: 'Model',
      keywords: ['claude', 'anthropic', 'model', 'cli'],
      action: () => { setSelectedModel('claude-code'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-codex-cli',
      label: 'Switch to Codex CLI',
      description: 'Set Codex CLI as primary model',
      icon: <Zap className="w-4 h-4 text-emerald-400" />,
      category: 'Model',
      keywords: ['codex', 'openai', 'model', 'code', 'cli'],
      action: () => { setSelectedModel('codex-cli'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-gemini-cli',
      label: 'Switch to Gemini CLI',
      description: 'Set Gemini CLI as primary model',
      icon: <Globe className="w-4 h-4 text-blue-400" />,
      category: 'Model',
      keywords: ['gemini', 'google', 'model', 'cli'],
      action: () => { setSelectedModel('gemini-cli'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-auto',
      label: 'Switch to Auto Router',
      description: 'Enable intelligent routing',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      category: 'Model',
      keywords: ['auto', 'router', 'smart', 'automatic'],
      action: () => { setSelectedModel('auto'); setCommandPaletteOpen(false) },
    },
    {
      id: 'clear-chat',
      label: 'Clear Current Chat',
      description: 'Remove all messages in this session',
      icon: <Trash2 className="w-4 h-4 text-red-400" />,
      category: 'Actions',
      keywords: ['clear', 'delete', 'remove', 'reset'],
      action: () => {
        const s = getActiveSession()
        if (s) clearSession(s.id)
        setCommandPaletteOpen(false)
      },
    },
  ]

  const filtered = query.trim()
    ? COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
        cmd.keywords.some(k => k.includes(query.toLowerCase()))
      )
    : COMMANDS

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  useEffect(() => {
    if (!commandPaletteOpen) setQuery('')
  }, [commandPaletteOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false)
      if (e.key === 'ArrowDown') setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
      if (e.key === 'ArrowUp') setSelectedIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Enter' && filtered[selectedIdx]) {
        filtered[selectedIdx].action()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, filtered, selectedIdx, setCommandPaletteOpen])

  let flatIdx = 0

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={() => setCommandPaletteOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -20 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden pointer-events-auto"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
                <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
                />
                <kbd className="text-[10px] text-zinc-600 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">ESC</kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {Object.keys(grouped).length === 0 ? (
                  <div className="py-12 text-center text-zinc-600 text-sm">No commands found</div>
                ) : (
                  <div className="p-2 space-y-2">
                    {Object.entries(grouped).map(([category, commands]) => (
                      <div key={category}>
                        <p className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                          {category}
                        </p>
                        <div className="space-y-0.5">
                          {commands.map(cmd => {
                            const isSelected = flatIdx === selectedIdx
                            const currentIdx = flatIdx++
                            return (
                              <button
                                key={cmd.id}
                                onClick={cmd.action}
                                onMouseEnter={() => setSelectedIdx(currentIdx)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-100',
                                  isSelected
                                    ? 'bg-violet-500/15 border border-violet-500/20 text-zinc-100'
                                    : 'text-zinc-400 hover:bg-white/5 border border-transparent'
                                )}
                              >
                                <span className={cn(isSelected ? 'text-violet-400' : 'text-zinc-500')}>
                                  {cmd.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{cmd.label}</p>
                                  {cmd.description && (
                                    <p className="text-[11px] text-zinc-600 truncate">{cmd.description}</p>
                                  )}
                                </div>
                                {isSelected && <ArrowRight className="w-3.5 h-3.5 text-violet-400" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[9px]">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[9px]">↵</kbd>
                  <span>Execute</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
