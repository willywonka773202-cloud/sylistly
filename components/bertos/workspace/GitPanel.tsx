'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch, RefreshCw, GitCommit, AlertTriangle,
  Loader2, WifiOff, ChevronDown, ChevronRight, Circle,
  Wand2, Check,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Types ──────────────────────────────────────────────────────────────────────

interface GitStatus {
  branch: string
  remote: string
  modified: string[]
  untracked: string[]
  staged: string[]
  ahead: number
  behind: number
}

interface DiffLine {
  type: 'added' | 'removed' | 'hunk' | 'header' | 'context'
  content: string
  lineNumLeft?: number
  lineNumRight?: number
}

interface GitPanelProps {
  onRefresh?: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAEMON_URL = 'http://localhost:3001'

// ── Diff parser (shared utility) ──────────────────────────────────────────────

function parseDiffLines(raw: string): DiffLine[] {
  const lines = raw.split('\n')
  const result: DiffLine[] = []
  let leftLine = 1
  let rightLine = 1

  for (const line of lines) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      result.push({ type: 'header', content: line })
    } else if (line.startsWith('@@ ')) {
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) { leftLine = parseInt(m[1], 10); rightLine = parseInt(m[2], 10) }
      result.push({ type: 'hunk', content: line })
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({ type: 'added', content: line.slice(1), lineNumRight: rightLine++ })
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({ type: 'removed', content: line.slice(1), lineNumLeft: leftLine++ })
    } else if (line.startsWith(' ') || line.length === 0) {
      result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : '', lineNumLeft: leftLine++, lineNumRight: rightLine++ })
    }
  }
  return result
}

// ── Inline diff viewer ────────────────────────────────────────────────────────

function InlineDiff({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 font-mono text-[10px]">
      <ScrollArea className="max-h-64">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'flex leading-5',
              line.type === 'added'   && 'bg-emerald-950/40',
              line.type === 'removed' && 'bg-red-950/40',
              line.type === 'hunk'    && 'bg-blue-950/30',
              line.type === 'header'  && 'bg-zinc-900/50',
            )}
          >
            <span className="w-7 flex-shrink-0 text-right pr-1.5 text-zinc-700 select-none border-r border-zinc-800/60 py-0.5">
              {line.lineNumLeft ?? ''}
            </span>
            <span className="w-7 flex-shrink-0 text-right pr-1.5 text-zinc-700 select-none border-r border-zinc-800/60 py-0.5">
              {line.lineNumRight ?? ''}
            </span>
            <span className={cn(
              'w-4 flex-shrink-0 text-center select-none py-0.5',
              line.type === 'added'   && 'text-emerald-400',
              line.type === 'removed' && 'text-red-400',
              line.type === 'hunk'    && 'text-blue-400',
            )}>
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : line.type === 'hunk' ? '@' : ' '}
            </span>
            <span className={cn(
              'flex-1 px-1.5 py-0.5 whitespace-pre overflow-hidden text-ellipsis',
              line.type === 'added'   && 'text-emerald-300',
              line.type === 'removed' && 'text-red-300',
              line.type === 'hunk'    && 'text-blue-300',
              line.type === 'header'  && 'text-zinc-500',
              line.type === 'context' && 'text-zinc-500',
            )}>
              {line.content || ' '}
            </span>
          </div>
        ))}
      </ScrollArea>
    </div>
  )
}

// ── File row ──────────────────────────────────────────────────────────────────

interface FileRowProps {
  path: string
  status: 'staged' | 'modified' | 'untracked'
  expanded: boolean
  diffLines: DiffLine[] | null
  loadingDiff: boolean
  onToggle: () => void
}

function FileRow({ path, status, expanded, diffLines, loadingDiff, onToggle }: FileRowProps) {
  const name = path.split('/').pop() ?? path

  const dotColor =
    status === 'staged'    ? 'bg-emerald-400' :
    status === 'modified'  ? 'bg-orange-400'  :
    'bg-zinc-500'

  const labelColor =
    status === 'staged'    ? 'text-emerald-400' :
    status === 'modified'  ? 'text-orange-400'  :
    'text-zinc-500'

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors text-left group',
          expanded ? 'bg-zinc-800/50 text-zinc-200' : 'hover:bg-white/5 text-zinc-400',
        )}
      >
        <Circle className={cn('w-1.5 h-1.5 flex-shrink-0 rounded-full fill-current', dotColor, labelColor)} />
        <span className="flex-1 truncate font-mono">{name}</span>
        <span className={cn('text-[10px] flex-shrink-0', labelColor)}>{status}</span>
        {expanded
          ? <ChevronDown className="w-3 h-3 text-zinc-600 flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden px-2 pb-2"
          >
            {loadingDiff ? (
              <div className="flex items-center gap-2 text-zinc-600 text-xs py-2 pl-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading diff…
              </div>
            ) : diffLines && diffLines.length > 0 ? (
              <InlineDiff lines={diffLines} />
            ) : (
              <p className="text-[10px] text-zinc-600 py-2 pl-1">No diff available</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function GitPanel({ onRefresh }: GitPanelProps) {
  const [status, setStatus]                 = useState<GitStatus | null>(null)
  const [loading, setLoading]               = useState(true)
  const [offline, setOffline]               = useState(false)
  const [spinning, setSpinning]             = useState(false)
  const [expandedFile, setExpandedFile]     = useState<string | null>(null)
  const [diffCache, setDiffCache]           = useState<Record<string, DiffLine[]>>({})
  const [loadingDiff, setLoadingDiff]       = useState<string | null>(null)
  const [commitMsg, setCommitMsg]           = useState('')
  const [generatingMsg, setGeneratingMsg]   = useState(false)
  const [committing, setCommitting]         = useState(false)
  const [commitDone, setCommitDone]         = useState(false)

  // ── Fetch status ────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setSpinning(true)
    setOffline(false)
    try {
      const res = await fetch(`${DAEMON_URL}/repo/status`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: GitStatus = await res.json()
      setStatus(data)
    } catch {
      setOffline(true)
      setStatus(null)
    } finally {
      setLoading(false)
      // Keep spin for a moment for UX feel
      setTimeout(() => setSpinning(false), 400)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleRefresh = useCallback(() => {
    fetchStatus()
    onRefresh?.()
  }, [fetchStatus, onRefresh])

  // ── Fetch diff for a file ────────────────────────────────────────────────────
  const handleToggleFile = useCallback(async (path: string) => {
    if (expandedFile === path) {
      setExpandedFile(null)
      return
    }
    setExpandedFile(path)

    if (diffCache[path]) return // already cached

    setLoadingDiff(path)
    try {
      const res = await fetch(
        `${DAEMON_URL}/repo/diff?path=${encodeURIComponent(path)}`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      setDiffCache(c => ({ ...c, [path]: parseDiffLines(text) }))
    } catch {
      setDiffCache(c => ({ ...c, [path]: [] }))
    } finally {
      setLoadingDiff(null)
    }
  }, [expandedFile, diffCache])

  // ── Generate commit message ─────────────────────────────────────────────────
  const handleGenerateCommitMsg = useCallback(async () => {
    if (!status) return
    const changes = [...(status.staged), ...(status.modified)]
    if (changes.length === 0) return

    setGeneratingMsg(true)
    try {
      const res = await fetch('/api/workspace/commit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (data.message) setCommitMsg(data.message)
    } catch {
      // silent — user can type manually
    } finally {
      setGeneratingMsg(false)
    }
  }, [status])

  // ── Commit staged ───────────────────────────────────────────────────────────
  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim()) return
    setCommitting(true)
    try {
      const res = await fetch(`${DAEMON_URL}/repo/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMsg }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCommitDone(true)
      setCommitMsg('')
      // Refresh status after commit
      setTimeout(() => {
        setCommitDone(false)
        fetchStatus()
      }, 2000)
    } finally {
      setCommitting(false)
    }
  }, [commitMsg, fetchStatus])

  // ── Offline state ───────────────────────────────────────────────────────────
  if (!loading && offline) {
    return (
      <div className="flex flex-col h-full bg-zinc-900">
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800">
          <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">
            Git
          </span>
        </div>
        <div className="m-3 p-4 rounded-lg bg-zinc-800/60 border border-zinc-700/50 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">Git panel requires local daemon</span>
          </div>
          <p className="text-xs text-zinc-500">
            Start the local daemon to view git status, diffs, and commit changes.
          </p>
          <code className="block text-[10px] font-mono text-zinc-400 bg-zinc-900 rounded px-2 py-1">
            npm run bertos:daemon
          </code>
          <Button size="sm" variant="secondary" onClick={handleRefresh} className="w-full">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry connection
          </Button>
        </div>
      </div>
    )
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-zinc-900">
        <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800">
          <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">Git</span>
        </div>
        <div className="p-3 space-y-2 animate-pulse">
          {[70, 55, 80, 45].map((w, i) => (
            <div key={i} className="h-5 rounded bg-zinc-800" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  const allChanged = [
    ...(status?.staged    ?? []).map(p => ({ path: p, status: 'staged' as const })),
    ...(status?.modified  ?? []).map(p => ({ path: p, status: 'modified' as const })),
    ...(status?.untracked ?? []).map(p => ({ path: p, status: 'untracked' as const })),
  ]

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800">
        <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">
          Git
        </span>
        <button
          onClick={handleRefresh}
          className="p-0.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('w-3 h-3', spinning && 'animate-spin')} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">

          {/* Branch info */}
          {status && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="success" className="gap-1">
                <GitBranch className="w-3 h-3" />
                {status.branch}
              </Badge>
              {status.remote && (
                <span className="text-[10px] text-zinc-600 truncate">{status.remote}</span>
              )}
              {status.ahead > 0 && (
                <Badge variant="info" className="text-[10px]">
                  ↑{status.ahead} ahead
                </Badge>
              )}
              {status.behind > 0 && (
                <Badge variant="warning" className="text-[10px]">
                  ↓{status.behind} behind
                </Badge>
              )}
            </div>
          )}

          {/* Changed files */}
          {allChanged.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-600 text-xs py-2">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              Working tree clean
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              {/* Group labels */}
              {status && status.staged.length > 0 && (
                <div className="px-3 py-1 bg-zinc-800/50 border-b border-zinc-800">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Staged ({status.staged.length})
                  </span>
                </div>
              )}
              {allChanged.map(({ path, status: fileStatus }) => {
                // Insert group header before first modified/untracked
                return (
                  <FileRow
                    key={path}
                    path={path}
                    status={fileStatus}
                    expanded={expandedFile === path}
                    diffLines={diffCache[path] ?? null}
                    loadingDiff={loadingDiff === path}
                    onToggle={() => handleToggleFile(path)}
                  />
                )
              })}
            </div>
          )}

          {/* Commit section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <GitCommit className="w-3 h-3 text-zinc-600" />
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider flex-1">
                Commit
              </span>
              <button
                onClick={handleGenerateCommitMsg}
                disabled={generatingMsg || allChanged.length === 0}
                className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors"
                title="Generate commit message with AI"
              >
                {generatingMsg ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wand2 className="w-3 h-3" />
                )}
                Generate
              </button>
            </div>

            {commitDone ? (
              <div className="flex items-center gap-2 text-emerald-400 text-xs">
                <Check className="w-3.5 h-3.5" />
                Committed successfully
              </div>
            ) : (
              <>
                <textarea
                  value={commitMsg}
                  onChange={e => setCommitMsg(e.target.value)}
                  rows={2}
                  placeholder="Commit message…"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 p-2 outline-none focus:border-violet-500/60 resize-none placeholder:text-zinc-600 font-mono transition-colors"
                />

                <Button
                  size="sm"
                  onClick={handleCommit}
                  disabled={committing || !commitMsg.trim() || (status?.staged.length ?? 0) === 0}
                  className="w-full"
                >
                  {committing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Committing…</>
                  ) : (
                    <><GitCommit className="w-3.5 h-3.5" />Commit staged</>
                  )}
                </Button>

                {(status?.staged.length ?? 0) === 0 && (
                  <p className="text-[10px] text-zinc-600">
                    Stage files in your terminal first: git add &lt;file&gt;
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-amber-600/80">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  Push requires your terminal — use: git push
                </div>
              </>
            )}
          </div>

        </div>
      </ScrollArea>
    </div>
  )
}
