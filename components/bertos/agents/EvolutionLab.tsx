'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dna, RefreshCw, AlertTriangle, Bug, Trash2, FileCode2,
  Lightbulb, Gauge, TestTube2, ChevronDown, ChevronUp,
  Sparkles, Play, Settings, ToggleLeft, ToggleRight, ShieldAlert,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface EvolutionSuggestion {
  id: string
  category: 'bug' | 'dead-code' | 'todo' | 'ui' | 'performance' | 'test'
  priority: 'critical' | 'high' | 'medium' | 'low'
  file: string
  title: string
  description: string
  impact: string
  risk: 'low' | 'medium' | 'high'
}

interface ScanResult {
  suggestions: EvolutionSuggestion[]
  scannedAt: number
  filesScanned: number
  error?: string
}

const CATEGORY_META: Record<EvolutionSuggestion['category'], {
  label: string
  icon: React.ElementType
  color: string
  borderColor: string
  bgColor: string
}> = {
  bug:         { label: 'Bug',         icon: Bug,       color: 'text-red-400',     borderColor: 'border-red-500/30',    bgColor: 'bg-red-500/5'    },
  'dead-code': { label: 'Dead Code',   icon: Trash2,    color: 'text-zinc-400',    borderColor: 'border-zinc-600/30',   bgColor: 'bg-zinc-700/5'   },
  todo:        { label: 'TODO',        icon: FileCode2, color: 'text-amber-400',   borderColor: 'border-amber-500/30',  bgColor: 'bg-amber-500/5'  },
  ui:          { label: 'UI',          icon: Lightbulb, color: 'text-blue-400',    borderColor: 'border-blue-500/30',   bgColor: 'bg-blue-500/5'   },
  performance: { label: 'Performance', icon: Gauge,     color: 'text-orange-400',  borderColor: 'border-orange-500/30', bgColor: 'bg-orange-500/5' },
  test:        { label: 'Tests',       icon: TestTube2, color: 'text-violet-400',  borderColor: 'border-violet-500/30', bgColor: 'bg-violet-500/5' },
}

const PRIORITY_BADGE: Record<EvolutionSuggestion['priority'], {
  variant: 'error' | 'warning' | 'info' | 'default'
  label: string
}> = {
  critical: { variant: 'error',   label: 'CRITICAL' },
  high:     { variant: 'warning', label: 'HIGH'     },
  medium:   { variant: 'info',    label: 'MEDIUM'   },
  low:      { variant: 'default', label: 'LOW'      },
}

const RISK_BADGE: Record<EvolutionSuggestion['risk'], {
  variant: 'error' | 'warning' | 'default'
  label: string
}> = {
  high:   { variant: 'error',   label: 'High Risk'   },
  medium: { variant: 'warning', label: 'Medium Risk' },
  low:    { variant: 'default', label: 'Low Risk'    },
}

const SCAN_DEPTHS = [
  { value: 'shallow', label: 'Shallow', desc: 'Top-level files only' },
  { value: 'normal',  label: 'Normal',  desc: 'Full project scan'    },
  { value: 'deep',    label: 'Deep',    desc: 'Deep analysis mode'   },
] as const

type ScanDepth = 'shallow' | 'normal' | 'deep'

const STORAGE_KEY = 'bertos-evolution-results'

function loadCachedResults(): ScanResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScanResult
  } catch {
    return null
  }
}

function saveCachedResults(result: ScanResult) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
  } catch { /* ignore */ }
}

function SuggestionCard({ suggestion, onGenerateFix }: {
  suggestion: EvolutionSuggestion
  onGenerateFix: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [patchPreview, setPatchPreview] = useState<string | null>(null)
  const meta = CATEGORY_META[suggestion.category]
  const priority = PRIORITY_BADGE[suggestion.priority]
  const risk = RISK_BADGE[suggestion.risk]
  const Icon = meta.icon

  const handleGenerateFix = async () => {
    setGenerating(true)
    setPatchPreview(null)
    try {
      await onGenerateFix(suggestion.id)
      // Simulate patch generation response for display
      setPatchPreview(
        `--- a/${suggestion.file}\n+++ b/${suggestion.file}\n@@ ... @@\n` +
        `- // TODO: fix this\n+ // Fixed: ${suggestion.title}`
      )
    } finally {
      setGenerating(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all duration-200',
        meta.borderColor, meta.bgColor
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border',
          meta.borderColor, meta.bgColor
        )}>
          <Icon className={cn('w-4 h-4', meta.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h3 className="text-sm font-semibold text-zinc-200">{suggestion.title}</h3>
            <Badge variant={priority.variant} className="text-[9px] h-4">{priority.label}</Badge>
            <Badge variant="default" className={cn('text-[9px] h-4', meta.color)}>{meta.label}</Badge>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors font-mono"
          >
            <FileCode2 className="w-3 h-3" />
            {suggestion.file}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={risk.variant} className="text-[9px] h-4 hidden sm:flex">{risk.label}</Badge>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 font-medium">What to fix</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{suggestion.description}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-zinc-400 font-medium">Expected impact</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{suggestion.impact}</p>
              </div>

              {patchPreview && (
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
                    <FileCode2 className="w-3 h-3 text-zinc-600" />
                    <span className="text-[10px] text-zinc-600 font-mono">patch preview (approval required)</span>
                  </div>
                  <pre className="p-3 text-[10px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                    {patchPreview}
                  </pre>
                  <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/30">
                    <p className="text-[10px] text-amber-400">Patch requires manual review and approval before applying.</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateFix}
                  disabled={generating}
                  className="h-7 text-xs"
                >
                  {generating
                    ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</>
                    : <><Sparkles className="w-3 h-3" /> Generate Fix</>}
                </Button>
                <Badge variant={risk.variant} className="text-[9px] h-4 sm:hidden">{risk.label}</Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function EvolutionLab() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [autoScan, setAutoScan] = useState(false)
  const [scanDepth, setScanDepth] = useState<ScanDepth>('normal')
  const [runningCycle, setRunningCycle] = useState(false)
  const [activeCategory, setActiveCategory] = useState<EvolutionSuggestion['category'] | 'all'>('all')
  const [cycleLog, setCycleLog] = useState<string[]>([])

  // Load cached results on mount
  useEffect(() => {
    const cached = loadCachedResults()
    if (cached) setScanResult(cached)
  }, [])

  // Auto-scan on startup if enabled
  useEffect(() => {
    if (autoScan && !scanResult) {
      runScan()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScan])

  const runScan = async () => {
    setScanning(true)
    setScanError(null)
    try {
      const res = await fetch('/api/evolution/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depth: scanDepth }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ScanResult
      setScanResult(data)
      saveCachedResults(data)
      if (data.error) setScanError(data.error)
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  const handleGenerateFix = async (id: string) => {
    // Stub: in practice this would call /api/evolution/fix
    await new Promise(r => setTimeout(r, 1200))
  }

  const runEvolutionCycle = async () => {
    if (!scanResult || scanResult.suggestions.length === 0) return
    setRunningCycle(true)
    setCycleLog([])

    const top3 = [...scanResult.suggestions]
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 }
        return order[a.priority] - order[b.priority]
      })
      .slice(0, 3)

    for (const s of top3) {
      setCycleLog(prev => [...prev, `Processing: ${s.title} (${s.file})`])
      await new Promise(r => setTimeout(r, 900))
      setCycleLog(prev => [...prev, `  Generated patch for "${s.title}" — awaiting approval`])
    }

    setCycleLog(prev => [...prev, 'Evolution cycle complete. All patches require manual approval.'])
    setRunningCycle(false)
  }

  const suggestions = scanResult?.suggestions ?? []
  const filtered = activeCategory === 'all'
    ? suggestions
    : suggestions.filter(s => s.category === activeCategory)

  const categoryCounts = suggestions.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1
    return acc
  }, {})

  const criticalCount = suggestions.filter(s => s.priority === 'critical').length
  const highCount = suggestions.filter(s => s.priority === 'high').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-zinc-800/50 bg-zinc-950/40">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-violet-500/20 border border-zinc-700/50 flex items-center justify-center">
            <Dna className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Evolution Lab</h2>
            <p className="text-[11px] text-zinc-500">Self-improvement scanner — patches always require approval</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {scanResult && !scanning && (
              <Button
                size="sm"
                variant="outline"
                onClick={runEvolutionCycle}
                disabled={runningCycle || suggestions.length === 0}
                className="h-7 text-xs"
              >
                {runningCycle
                  ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running…</>
                  : <><Play className="w-3 h-3" /> Run Evolution Cycle</>}
              </Button>
            )}
            <Button
              size="sm"
              onClick={runScan}
              disabled={scanning}
            >
              {scanning
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Scanning…</>
                : <><Dna className="w-3 h-3" /> Start Scan</>}
            </Button>
          </div>
        </div>

        {/* Settings row */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs text-zinc-500">Scan depth:</span>
            <div className="flex items-center gap-1">
              {SCAN_DEPTHS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setScanDepth(d.value)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] transition-all',
                    scanDepth === d.value
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setAutoScan(!autoScan)}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {autoScan
              ? <ToggleRight className="w-4 h-4 text-violet-400" />
              : <ToggleLeft className="w-4 h-4 text-zinc-600" />}
            Auto-scan on startup
          </button>

          {scanResult && (
            <span className="text-[10px] text-zinc-700 ml-auto">
              Last scan: {new Date(scanResult.scannedAt).toLocaleTimeString()} · {scanResult.filesScanned} files
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-4 max-w-4xl mx-auto space-y-4">

          {/* Scanning animation */}
          {scanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="mb-4"
              >
                <Dna className="w-10 h-10 text-emerald-400" />
              </motion.div>
              <p className="text-sm text-zinc-300 font-medium">Scanning codebase…</p>
              <p className="text-xs text-zinc-600 mt-1">Analyzing structure, patterns, and potential improvements</p>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-zinc-700">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>This may take a moment depending on repository size</span>
              </div>
            </motion.div>
          )}

          {/* Error state */}
          {scanError && !scanning && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Scan encountered an issue</p>
                <p className="text-xs text-red-400/70 mt-0.5">{scanError}</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!scanning && !scanResult && !scanError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-4">
                <Dna className="w-8 h-8 text-zinc-700" />
              </div>
              <p className="text-sm text-zinc-500 font-medium">Run a scan to discover improvement opportunities</p>
              <p className="text-xs text-zinc-700 mt-1 max-w-xs leading-relaxed">
                The Evolution Lab analyzes your codebase and suggests targeted improvements across bugs, dead code, performance, tests, and more.
              </p>
              <Button onClick={runScan} size="sm" className="mt-5">
                <Dna className="w-3.5 h-3.5" />
                Start Scan
              </Button>
            </motion.div>
          )}

          {/* Results */}
          {!scanning && scanResult && suggestions.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                  <p className="text-xl font-bold text-zinc-200">{suggestions.length}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Total suggestions</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
                  <p className="text-xl font-bold text-red-300">{criticalCount}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Critical</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <p className="text-xl font-bold text-amber-300">{highCount}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">High priority</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-center">
                  <p className="text-xl font-bold text-zinc-400">{scanResult.filesScanned}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Files scanned</p>
                </div>
              </div>

              {/* Never auto-apply notice */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-400/80 leading-relaxed">
                  Evolution Lab never auto-applies patches. Every generated fix requires your explicit review and approval before any changes are made to your codebase.
                </p>
              </div>

              {/* Category filter tabs */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border',
                    activeCategory === 'all'
                      ? 'bg-zinc-800 text-zinc-200 border-zinc-700'
                      : 'text-zinc-600 hover:text-zinc-400 border-transparent hover:border-zinc-800'
                  )}
                >
                  All
                  <span className="text-[9px] bg-zinc-700 text-zinc-400 rounded-full px-1.5 py-0.5">{suggestions.length}</span>
                </button>
                {(Object.keys(CATEGORY_META) as EvolutionSuggestion['category'][]).map(cat => {
                  const count = categoryCounts[cat] ?? 0
                  if (count === 0) return null
                  const meta = CATEGORY_META[cat]
                  const Icon = meta.icon
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border',
                        activeCategory === cat
                          ? `${meta.bgColor} ${meta.color} ${meta.borderColor}`
                          : 'text-zinc-600 hover:text-zinc-400 border-transparent hover:border-zinc-800'
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {meta.label}
                      <span className="text-[9px] bg-zinc-800 text-zinc-500 rounded-full px-1.5 py-0.5">{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Suggestion list */}
              <div className="space-y-3">
                <AnimatePresence>
                  {filtered.map(s => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onGenerateFix={handleGenerateFix}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* No results after scan */}
          {!scanning && scanResult && suggestions.length === 0 && !scanError && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm text-zinc-300 font-medium">No issues found</p>
              <p className="text-xs text-zinc-600 mt-1">Your codebase looks clean. Run a deeper scan to check again.</p>
            </div>
          )}

          {/* Evolution cycle log */}
          {cycleLog.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
                <p className="text-xs font-semibold text-zinc-300">Evolution Cycle Log</p>
                {runningCycle && <RefreshCw className="w-3 h-3 text-zinc-600 animate-spin ml-auto" />}
              </div>
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[10px] space-y-1 max-h-40 overflow-y-auto">
                {cycleLog.map((line, i) => (
                  <p key={i} className={cn(
                    line.startsWith('  ') ? 'text-zinc-600' : 'text-zinc-400'
                  )}>{line}</p>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
