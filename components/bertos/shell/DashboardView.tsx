'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Wifi, WifiOff, RefreshCw, MessageSquare, Bot, Code2,
  GitBranch, FileCode2, Dna, Zap, Brain, Plus, Play,
  ChevronRight, Activity, Clock, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useAgentStore } from '@/store/bertos/agents'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DaemonStatus {
  online: boolean
  branch?: string
  changes?: number
  staged?: number
}

interface OllamaInfo {
  mode?: string
  defaultModel?: string
  online?: boolean
}

interface ProviderCounts {
  total?: number
  available?: number
  cli?: number
}

interface EvolutionCached {
  suggestions: Array<{
    id: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    file: string
  }>
  scannedAt: number
  filesScanned: number
}

const EVOLUTION_STORAGE_KEY = 'bertos-evolution-results'

function loadEvolutionCache(): EvolutionCached | null {
  try {
    const raw = localStorage.getItem(EVOLUTION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as EvolutionCached
  } catch {
    return null
  }
}

const PRIORITY_BADGE_VARIANT: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  critical: 'error',
  high:     'warning',
  medium:   'info',
  low:      'default',
}

// ── Widget shell ──────────────────────────────────────────────────────────────

function Widget({
  title,
  icon: Icon,
  iconColor = 'text-violet-400',
  children,
  onViewAll,
  viewAllLabel = 'View all',
  className,
}: {
  title: string
  icon: React.ElementType
  iconColor?: string
  children: React.ReactNode
  onViewAll?: () => void
  viewAllLabel?: string
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 flex flex-col gap-3',
        className
      )}
    >
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-3.5 h-3.5', iconColor)} />
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</h3>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {viewAllLabel}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </motion.div>
  )
}

// ── Widget 1: System Status ───────────────────────────────────────────────────

function SystemStatusWidget() {
  const [daemon, setDaemon] = useState<DaemonStatus>({ online: false })
  const [ollama, setOllama] = useState<OllamaInfo | null>(null)
  const [providers, setProviders] = useState<ProviderCounts | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [daemonResult, ollamaResult, providersResult] = await Promise.allSettled([
      fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(2000) })
        .then(r => r.ok ? r.json() as Promise<{ status?: string }> : null)
        .then(d => ({ online: !!d }))
        .catch(() => ({ online: false })),
      fetch('/api/bertos/mode')
        .then(r => r.json() as Promise<OllamaInfo>)
        .catch(() => null),
      fetch('/api/providers/status')
        .then(r => r.json() as Promise<ProviderCounts>)
        .catch(() => null),
    ])

    if (daemonResult.status === 'fulfilled') {
      const base = daemonResult.value as DaemonStatus
      if (base.online) {
        try {
          const gitRes = await fetch('http://localhost:3001/repo/status', {
            signal: AbortSignal.timeout(2000),
          })
          if (gitRes.ok) {
            const gitData = await gitRes.json() as { branch?: string; changes?: number; staged?: number }
            setDaemon({ ...base, ...gitData })
          } else {
            setDaemon(base)
          }
        } catch {
          setDaemon(base)
        }
      } else {
        setDaemon(base)
      }
    }
    if (ollamaResult.status === 'fulfilled') setOllama(ollamaResult.value)
    if (providersResult.status === 'fulfilled') setProviders(providersResult.value)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <Widget
      title="System Status"
      icon={Activity}
      iconColor="text-emerald-400"
      onViewAll={refresh}
      viewAllLabel="Refresh"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            {daemon.online
              ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              : <WifiOff className="w-3.5 h-3.5 text-zinc-600" />}
            <span className="text-xs text-zinc-400">Daemon</span>
          </div>
          <Badge variant={daemon.online ? 'success' : 'default'} className="text-[9px] h-4">
            {loading ? 'Checking' : daemon.online ? 'Online' : 'Offline'}
          </Badge>
        </div>

        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <Bot className={cn('w-3.5 h-3.5', ollama?.online ? 'text-orange-400' : 'text-zinc-600')} />
            <span className="text-xs text-zinc-400">Ollama</span>
          </div>
          <div className="flex items-center gap-1.5">
            {ollama?.defaultModel && (
              <span className="text-[10px] text-zinc-600 font-mono">{ollama.defaultModel}</span>
            )}
            {ollama?.mode && (
              <Badge variant="default" className="text-[9px] h-4">{ollama.mode}</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-zinc-400">Providers</span>
          </div>
          <span className="text-[10px] text-zinc-500">
            {providers
              ? `${providers.available ?? 0}/${providers.total ?? 0} available`
              : '—'}
          </span>
        </div>

        {daemon.online && (
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs text-zinc-400">Repo</span>
            </div>
            <div className="flex items-center gap-1.5">
              {daemon.branch && (
                <span className="text-[10px] text-zinc-500 font-mono">{daemon.branch}</span>
              )}
              {(daemon.changes ?? 0) > 0 && (
                <Badge variant="warning" className="text-[9px] h-4">{daemon.changes} changes</Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </Widget>
  )
}

// ── Widget 2: Recent Activity ─────────────────────────────────────────────────

function RecentActivityWidget() {
  const { sessions, setActiveSession } = useChatStore()
  const { setActiveView } = useUIStore()
  const router = useRouter()

  const recent = sessions.slice(0, 5)

  const openSession = (id: string) => {
    setActiveSession(id)
    setActiveView('chat')
    router.push('/chat')
  }

  return (
    <Widget
      title="Recent Activity"
      icon={MessageSquare}
      iconColor="text-blue-400"
      onViewAll={() => { setActiveView('chat'); router.push('/chat') }}
    >
      {recent.length === 0 ? (
        <p className="text-xs text-zinc-600 py-2 text-center">No recent chats</p>
      ) : (
        <div className="space-y-1">
          {recent.map(session => (
            <button
              key={session.id}
              onClick={() => openSession(session.id)}
              className="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
            >
              <MessageSquare className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5 group-hover:text-zinc-400 transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate font-medium group-hover:text-zinc-100 transition-colors">
                  {session.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-zinc-600">{session.model}</span>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-600">{session.messages.length} msgs</span>
                  <span className="text-[10px] text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-700">
                    {new Date(session.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Widget>
  )
}

// ── Widget 3: Active Tasks ────────────────────────────────────────────────────

function ActiveTasksWidget() {
  const { tasks } = useAgentStore()
  const { setActiveView } = useUIStore()
  const router = useRouter()

  const active = tasks.filter(t => t.status === 'running' || t.status === 'pending')

  return (
    <Widget
      title="Active Tasks"
      icon={Bot}
      iconColor="text-violet-400"
      onViewAll={() => { setActiveView('agents'); router.push('/agents') }}
    >
      {active.length === 0 ? (
        <p className="text-xs text-zinc-600 py-2 text-center">No active tasks</p>
      ) : (
        <div className="space-y-2.5">
          {active.slice(0, 4).map(task => (
            <div key={task.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-300 font-medium truncate flex-1 mr-2">{task.title}</p>
                <Badge
                  variant={task.status === 'running' ? 'info' : 'default'}
                  className="text-[9px] h-4 flex-shrink-0"
                >
                  {task.status === 'running' ? 'Running' : 'Pending'}
                </Badge>
              </div>
              {task.status === 'running' && (
                <div className="space-y-0.5">
                  <Progress value={task.progress} className="h-1" />
                  <p className="text-[10px] text-zinc-600">{task.progress}%</p>
                </div>
              )}
            </div>
          ))}
          {active.length > 4 && (
            <p className="text-[10px] text-zinc-700">+{active.length - 4} more tasks</p>
          )}
        </div>
      )}
    </Widget>
  )
}

// ── Widget 4: Quick Actions ───────────────────────────────────────────────────

function QuickActionsWidget() {
  const { setActiveView } = useUIStore()
  const { createSession } = useChatStore()
  const router = useRouter()

  const actions = [
    {
      label: 'New Chat',
      icon: Plus,
      color: 'text-violet-400',
      border: 'border-zinc-800 hover:border-violet-500/30',
      bg: 'hover:bg-violet-500/5',
      action: () => { createSession(); setActiveView('chat'); router.push('/chat') },
    },
    {
      label: 'Open Workspace',
      icon: Code2,
      color: 'text-blue-400',
      border: 'border-zinc-800 hover:border-blue-500/30',
      bg: 'hover:bg-blue-500/5',
      action: () => { setActiveView('workspace'); router.push('/workspace') },
    },
    {
      label: 'Generate Patch',
      icon: FileCode2,
      color: 'text-emerald-400',
      border: 'border-zinc-800 hover:border-emerald-500/30',
      bg: 'hover:bg-emerald-500/5',
      action: () => { setActiveView('workspace'); router.push('/workspace?mode=patch') },
    },
    {
      label: 'Evolution Scan',
      icon: Dna,
      color: 'text-teal-400',
      border: 'border-zinc-800 hover:border-teal-500/30',
      bg: 'hover:bg-teal-500/5',
      action: () => { setActiveView('agents'); router.push('/agents?tab=evolution') },
    },
    {
      label: 'Run Build',
      icon: Play,
      color: 'text-amber-400',
      border: 'border-zinc-800 hover:border-amber-500/30',
      bg: 'hover:bg-amber-500/5',
      action: () => { setActiveView('workspace'); router.push('/workspace?mode=build') },
    },
    {
      label: 'Open Memory',
      icon: Brain,
      color: 'text-pink-400',
      border: 'border-zinc-800 hover:border-pink-500/30',
      bg: 'hover:bg-pink-500/5',
      action: () => { setActiveView('memory'); router.push('/memory') },
    },
  ]

  return (
    <Widget title="Quick Actions" icon={Zap} iconColor="text-amber-400">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.action}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left',
              a.border, a.bg
            )}
          >
            <a.icon className={cn('w-3.5 h-3.5 flex-shrink-0', a.color)} />
            <span className="text-xs text-zinc-400 font-medium">{a.label}</span>
          </button>
        ))}
      </div>
    </Widget>
  )
}

// ── Widget 5: Evolution Suggestions ──────────────────────────────────────────

function EvolutionSuggestionsWidget() {
  const [cached, setCached] = useState<EvolutionCached | null>(null)
  const { setActiveView } = useUIStore()
  const router = useRouter()

  useEffect(() => {
    setCached(loadEvolutionCache())
  }, [])

  const top3 = cached?.suggestions?.slice(0, 3) ?? []

  return (
    <Widget
      title="Evolution Suggestions"
      icon={Dna}
      iconColor="text-emerald-400"
      onViewAll={() => { setActiveView('agents'); router.push('/agents?tab=evolution') }}
      viewAllLabel="View All"
    >
      {!cached ? (
        <div className="text-center py-3">
          <p className="text-xs text-zinc-600">No scan results yet</p>
          <button
            onClick={() => { setActiveView('agents'); router.push('/agents?tab=evolution') }}
            className="mt-1.5 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
          >
            Run a scan in Evolution Lab
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {top3.length === 0 ? (
            <p className="text-xs text-zinc-600 py-2 text-center">No suggestions from last scan</p>
          ) : (
            top3.map(s => (
              <div
                key={s.id}
                className="flex items-start gap-2.5 px-2 py-2 rounded-lg border border-zinc-800 bg-zinc-900/30"
              >
                <Badge
                  variant={PRIORITY_BADGE_VARIANT[s.priority] ?? 'default'}
                  className="text-[9px] h-4 flex-shrink-0 mt-0.5"
                >
                  {s.priority.toUpperCase()}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 font-medium truncate">{s.title}</p>
                  <p className="text-[10px] text-zinc-600 font-mono truncate">{s.file}</p>
                </div>
              </div>
            ))
          )}
          {cached.scannedAt && (
            <p className="text-[10px] text-zinc-700 text-right">
              <Clock className="w-2.5 h-2.5 inline mr-1" />
              {new Date(cached.scannedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </Widget>
  )
}

// ── Widget 6: Git Status ──────────────────────────────────────────────────────

function GitStatusWidget() {
  const [gitData, setGitData] = useState<{
    branch?: string
    modified?: number
    staged?: number
    loading: boolean
    offline: boolean
  }>({ loading: true, offline: false })

  useEffect(() => {
    fetch('http://localhost:3001/repo/status', { signal: AbortSignal.timeout(2000) })
      .then(r => r.ok ? r.json() as Promise<{ branch?: string; modified?: number; staged?: number; changes?: number }> : null)
      .then(d => {
        if (!d) {
          setGitData({ loading: false, offline: true })
        } else {
          setGitData({
            branch: d.branch,
            modified: d.modified ?? d.changes ?? 0,
            staged: d.staged ?? 0,
            loading: false,
            offline: false,
          })
        }
      })
      .catch(() => setGitData({ loading: false, offline: true }))
  }, [])

  const commitChanges = () => {
    window.dispatchEvent(new CustomEvent('bertos:open-commit'))
  }

  return (
    <Widget title="Git Status" icon={GitBranch} iconColor="text-violet-400">
      {gitData.loading && (
        <div className="flex items-center gap-2 py-2">
          <RefreshCw className="w-3.5 h-3.5 text-zinc-600 animate-spin" />
          <span className="text-xs text-zinc-600">Checking git status…</span>
        </div>
      )}
      {gitData.offline && !gitData.loading && (
        <div className="flex items-center gap-2 py-2 text-xs text-zinc-600">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Daemon offline — git status unavailable
        </div>
      )}
      {!gitData.loading && !gitData.offline && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-zinc-300 font-mono">{gitData.branch ?? 'unknown'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 text-center">
              <p className="text-lg font-bold text-zinc-300">{gitData.modified ?? 0}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Modified</p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-300">{gitData.staged ?? 0}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Staged</p>
            </div>
          </div>
          {(gitData.staged ?? 0) > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={commitChanges}
              className="w-full h-7 text-xs"
            >
              <GitBranch className="w-3 h-3" />
              Commit {gitData.staged} staged changes
            </Button>
          )}
        </div>
      )}
    </Widget>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function DashboardView() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-zinc-700/50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Dashboard</h2>
            <p className="text-[11px] text-zinc-500">BertOS command center overview</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 max-w-6xl mx-auto">
          {/* 3-column grid on desktop, 1-column on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SystemStatusWidget />
            <RecentActivityWidget />
            <ActiveTasksWidget />
            <QuickActionsWidget />
            <EvolutionSuggestionsWidget />
            <GitStatusWidget />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
