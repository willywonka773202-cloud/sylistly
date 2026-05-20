'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wand2, ChevronDown, CheckCircle2, XCircle, Edit3, Terminal,
  GitCommit, AlertTriangle, Loader2, WifiOff, Play, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { readAIStream } from '@/lib/bertos/stream-utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type WorkflowState = 'idle' | 'generating' | 'reviewing' | 'applying' | 'done' | 'error'
type Provider = 'auto' | 'claude-code' | 'codex' | 'gemini' | 'ollama-pro'
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

interface DiffLine {
  type: 'added' | 'removed' | 'hunk' | 'context' | 'header'
  content: string
  lineNumLeft?: number
  lineNumRight?: number
}

interface ParsedDiff {
  filename: string
  additions: number
  deletions: number
  lines: DiffLine[]
}

interface CommitModalProps {
  diff: ParsedDiff
  onClose: () => void
}

interface PatchWorkflowProps {
  activeFile: string | null
  fileContent: string
  repoContext?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: 'auto',       label: 'Auto' },
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'codex',      label: 'Codex' },
  { value: 'gemini',     label: 'Gemini' },
  { value: 'ollama-pro', label: 'Ollama Pro' },
]

// ── Diff parser ────────────────────────────────────────────────────────────────

function parseDiff(raw: string): ParsedDiff | null {
  const lines = raw.split('\n')
  const result: DiffLine[] = []
  let additions = 0
  let deletions = 0
  let filename = ''
  let leftLine = 1
  let rightLine = 1

  for (const line of lines) {
    if (line.startsWith('--- ')) {
      result.push({ type: 'header', content: line })
      const m = line.match(/^--- (.+)/)
      if (m) filename = m[1].replace(/^a\//, '')
    } else if (line.startsWith('+++ ')) {
      result.push({ type: 'header', content: line })
      const m = line.match(/^\+\+\+ (.+)/)
      if (m && !filename) filename = m[1].replace(/^b\//, '')
    } else if (line.startsWith('@@ ')) {
      // Parse hunk header: @@ -l,s +l,s @@
      const m = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (m) {
        leftLine  = parseInt(m[1], 10)
        rightLine = parseInt(m[2], 10)
      }
      result.push({ type: 'hunk', content: line })
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({ type: 'added', content: line.slice(1), lineNumRight: rightLine++ })
      additions++
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({ type: 'removed', content: line.slice(1), lineNumLeft: leftLine++ })
      deletions++
    } else if (line.startsWith(' ') || (!line.startsWith('\\') && line.length > 0)) {
      result.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line, lineNumLeft: leftLine++, lineNumRight: rightLine++ })
    }
  }

  if (result.length === 0) return null
  return { filename: filename || 'unknown', additions, deletions, lines: result }
}

function getRiskLevel(additions: number, deletions: number): RiskLevel {
  const total = additions + deletions
  if (total > 50) return 'HIGH'
  if (total > 20) return 'MEDIUM'
  return 'LOW'
}

// ── Diff Viewer ────────────────────────────────────────────────────────────────

function DiffViewer({ diff }: { diff: ParsedDiff }) {
  const risk = getRiskLevel(diff.additions, diff.deletions)

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 font-mono text-xs">
      {/* Diff header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800 bg-zinc-900/70 flex-wrap gap-y-1.5">
        <code className="text-violet-400 truncate flex-1 min-w-0">{diff.filename}</code>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-emerald-400">+{diff.additions}</span>
          <span className="text-red-400">-{diff.deletions}</span>
          <Badge
            className={cn(
              'text-[10px]',
              risk === 'LOW'    && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
              risk === 'MEDIUM' && 'border-amber-500/30 bg-amber-500/10 text-amber-300',
              risk === 'HIGH'   && 'border-red-500/30 bg-red-500/10 text-red-300',
            )}
          >
            {risk} risk
          </Badge>
        </div>
      </div>

      {/* Lines */}
      <ScrollArea className="max-h-80">
        <div className="p-0">
          {diff.lines.map((line, i) => (
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
              {/* Line numbers */}
              <span className="w-8 flex-shrink-0 text-right pr-2 text-zinc-700 select-none border-r border-zinc-800/60 text-[10px] py-0.5">
                {line.lineNumLeft ?? ''}
              </span>
              <span className="w-8 flex-shrink-0 text-right pr-2 text-zinc-700 select-none border-r border-zinc-800/60 text-[10px] py-0.5">
                {line.lineNumRight ?? ''}
              </span>
              {/* Gutter symbol */}
              <span className={cn(
                'w-5 flex-shrink-0 text-center select-none py-0.5',
                line.type === 'added'   && 'text-emerald-400',
                line.type === 'removed' && 'text-red-400',
                line.type === 'hunk'    && 'text-blue-400',
                line.type === 'context' && 'text-zinc-700',
              )}>
                {line.type === 'added'   ? '+' :
                 line.type === 'removed' ? '-' :
                 line.type === 'hunk'    ? '@' : ' '}
              </span>
              {/* Content */}
              <span className={cn(
                'flex-1 px-2 py-0.5 whitespace-pre overflow-hidden text-ellipsis',
                line.type === 'added'   && 'text-emerald-300',
                line.type === 'removed' && 'text-red-300',
                line.type === 'hunk'    && 'text-blue-300',
                line.type === 'header'  && 'text-zinc-500',
                line.type === 'context' && 'text-zinc-400',
              )}>
                {line.content || ' '}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ── Commit Modal ───────────────────────────────────────────────────────────────

function CommitModal({ diff, onClose }: CommitModalProps) {
  const [message, setMessage] = useState(`Apply AI patch: ${diff.filename}`)
  const [committing, setCommitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleCommit = async () => {
    setCommitting(true)
    try {
      await fetch('http://localhost:3001/repo/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, files: [diff.filename] }),
      })
      setDone(true)
    } finally {
      setCommitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Commit this change</h3>
        </div>

        {done ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Committed! Use your terminal to push.
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 p-2.5 outline-none focus:border-violet-500 resize-none font-mono"
              placeholder="Commit message..."
            />
            <p className="text-[10px] text-zinc-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Push requires your terminal — use: git push
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleCommit}
                disabled={committing || !message.trim()}
              >
                {committing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Commit staged
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PatchWorkflow({ activeFile, fileContent, repoContext }: PatchWorkflowProps) {
  const [state, setState]                 = useState<WorkflowState>('idle')
  const [prompt, setPrompt]               = useState('')
  const [provider, setProvider]           = useState<Provider>('auto')
  const [includeRepo, setIncludeRepo]     = useState(false)
  const [rawResponse, setRawResponse]     = useState('')
  const [parsedDiff, setParsedDiff]       = useState<ParsedDiff | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [typecheckResult, setTypecheckResult] = useState<{ pass: boolean; output: string } | null>(null)
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [streamProgress, setStreamProgress]   = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // ── Generate patch ──────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setState('generating')
    setError(null)
    setRawResponse('')
    setParsedDiff(null)
    setTypecheckResult(null)
    setStreamProgress('')

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/workspace/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          file: activeFile ?? 'untitled',
          content: fileContent,
          provider,
          repoContext: includeRepo ? repoContext : undefined,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      let accumulated = ''
      await readAIStream(
        res,
        chunk => {
          accumulated += chunk
          setStreamProgress(accumulated)
          setRawResponse(accumulated)
        },
        () => {
          const diff = parseDiff(accumulated)
          setParsedDiff(diff)
          setState('reviewing')
        },
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Generation failed')
      setState('error')
    }
  }, [prompt, activeFile, fileContent, provider, includeRepo, repoContext])

  // ── Apply patch ─────────────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    if (!parsedDiff) return
    setState('applying')
    try {
      const res = await fetch('http://localhost:3001/repo/apply-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: activeFile, patch: rawResponse }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Apply failed: HTTP ${res.status}`)
      }

      // Auto-run typecheck
      try {
        const tcRes = await fetch('http://localhost:3001/repo/typecheck', {
          method: 'POST',
          signal: AbortSignal.timeout(30000),
        })
        const tcData = await tcRes.json() as { pass: boolean; output: string }
        setTypecheckResult(tcData)
      } catch {
        setTypecheckResult({ pass: true, output: '(typecheck skipped — daemon unavailable)' })
      }

      setState('done')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Apply failed'
      if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch')) {
        setError('Apply requires local daemon — review the diff and apply manually.')
      } else {
        setError(msg)
      }
      setState('error')
    }
  }, [parsedDiff, rawResponse, activeFile])

  // ── Ask AI to fix typecheck errors ──────────────────────────────────────────
  const handleAskAIToFix = useCallback(() => {
    if (!typecheckResult) return
    setPrompt(`Fix the TypeScript errors:\n\n${typecheckResult.output}`)
    setState('idle')
    setParsedDiff(null)
    setRawResponse('')
    setTypecheckResult(null)
  }, [typecheckResult])

  // ── Reset ───────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    abortRef.current?.abort()
    setState('idle')
    setRawResponse('')
    setParsedDiff(null)
    setError(null)
    setTypecheckResult(null)
    setStreamProgress('')
  }, [])

  const risk = parsedDiff ? getRiskLevel(parsedDiff.additions, parsedDiff.deletions) : null

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <Wand2 className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">
          Patch Workflow
        </span>
        {state !== 'idle' && (
          <button
            onClick={handleReset}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">

          {/* ── Prompt bar ──────────────────────────────────────────── */}
          <div className="space-y-2">
            {/* Context chips */}
            <div className="flex flex-wrap gap-1.5">
              {activeFile && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  {activeFile.split('/').pop()}
                </span>
              )}
              {repoContext && (
                <button
                  onClick={() => setIncludeRepo(v => !v)}
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border transition-colors',
                    includeRepo
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-400',
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', includeRepo ? 'bg-blue-400' : 'bg-zinc-600')} />
                  Repo context
                </button>
              )}
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`What should the AI change in ${activeFile ? activeFile.split('/').pop() : 'this file'}?`}
              rows={3}
              disabled={state === 'generating' || state === 'applying'}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 p-2.5 outline-none focus:border-violet-500/60 resize-none placeholder:text-zinc-600 disabled:opacity-50 transition-colors"
            />

            {/* Provider selector + Generate button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <select
                  value={provider}
                  onChange={e => setProvider(e.target.value as Provider)}
                  disabled={state === 'generating'}
                  className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 px-2.5 py-1.5 pr-7 outline-none focus:border-violet-500/60 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
              </div>

              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={!prompt.trim() || state === 'generating' || state === 'applying'}
                className="flex-shrink-0"
              >
                {state === 'generating' ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</>
                ) : (
                  <><Play className="w-3.5 h-3.5" />Generate Patch</>
                )}
              </Button>
            </div>
          </div>

          {/* ── Streaming progress ───────────────────────────────────── */}
          <AnimatePresence>
            {state === 'generating' && streamProgress && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
                  <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                  <span className="text-[10px] text-zinc-500">AI is generating…</span>
                </div>
                <pre className="p-3 text-[10px] text-zinc-500 font-mono overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {streamProgress}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Diff viewer ──────────────────────────────────────────── */}
          <AnimatePresence>
            {(state === 'reviewing' || state === 'applying' || state === 'done') && parsedDiff && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <DiffViewer diff={parsedDiff} />

                {/* Approval panel */}
                {state === 'reviewing' && (
                  <div className="space-y-2">
                    {risk === 'HIGH' && (
                      <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        High change count — review carefully before applying.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleApply}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Apply Patch
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleReset}
                        className="flex-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setState('idle')}
                        className="flex-shrink-0"
                        title="Edit manually"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {state === 'applying' && (
                  <div className="flex items-center gap-2 text-violet-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Applying patch via daemon…
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Post-apply ───────────────────────────────────────────── */}
          <AnimatePresence>
            {state === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Patch applied successfully
                </div>

                {typecheckResult && (
                  <div className={cn(
                    'rounded-lg border p-3 space-y-2',
                    typecheckResult.pass
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-red-500/20 bg-red-500/5',
                  )}>
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                        TypeScript check
                      </span>
                      <Badge
                        variant={typecheckResult.pass ? 'success' : 'error'}
                        className="text-[10px] ml-auto"
                      >
                        {typecheckResult.pass ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                    {!typecheckResult.pass && (
                      <>
                        <pre className="text-[10px] text-red-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {typecheckResult.output}
                        </pre>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleAskAIToFix}
                          className="w-full"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          Ask AI to fix
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowCommitModal(true)}
                    className="flex-1"
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    Commit this change
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleReset}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    New patch
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Error state ──────────────────────────────────────────── */}
          <AnimatePresence>
            {state === 'error' && error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2"
              >
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium">
                  {error.includes('daemon') ? (
                    <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  {error}
                </div>
                <Button size="sm" variant="secondary" onClick={handleReset} className="w-full">
                  Try again
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </ScrollArea>

      {/* Commit modal */}
      <AnimatePresence>
        {showCommitModal && parsedDiff && (
          <CommitModal
            diff={parsedDiff}
            onClose={() => setShowCommitModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
