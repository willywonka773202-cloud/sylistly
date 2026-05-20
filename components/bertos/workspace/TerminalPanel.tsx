'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Terminal, Play, Square, ChevronDown, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const DAEMON = 'http://localhost:3001'

const SAFE_COMMANDS = [
  { label: 'git status',          cmd: 'git status'                        },
  { label: 'git diff',            cmd: 'git --no-pager diff'               },
  { label: 'git diff --staged',   cmd: 'git --no-pager diff --staged'      },
  { label: 'git log (5)',         cmd: 'git --no-pager log --oneline -5'   },
  { label: 'git branch',         cmd: 'git branch'                        },
  { label: 'npm run typecheck',   cmd: 'npm run typecheck'                 },
  { label: 'npm run build',       cmd: 'npm run build'                     },
  { label: 'npm run lint',        cmd: 'npm run lint'                      },
]

interface OutputLine {
  id: number
  type: 'stdout' | 'stderr' | 'exit' | 'error' | 'info'
  text: string
  code?: number
}

let lineId = 0

export function TerminalPanel() {
  const [selectedCmd, setSelectedCmd] = useState(SAFE_COMMANDS[0].cmd)
  const [running, setRunning]         = useState(false)
  const [lines, setLines]             = useState<OutputLine[]>([])
  const [exitCode, setExitCode]       = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const addLine = useCallback((type: OutputLine['type'], text: string, code?: number) => {
    setLines(prev => [...prev, { id: lineId++, type, text, code }])
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const handleRun = useCallback(async () => {
    if (running) return
    setRunning(true)
    setExitCode(null)
    setLines([])

    abortRef.current = new AbortController()

    addLine('info', `$ ${selectedCmd}`)

    // Client-side safety timeout — 65 s (daemon kills at 60 s)
    const timeoutId = setTimeout(() => {
      abortRef.current?.abort()
    }, 65_000)

    const processNdjsonLine = (line: string) => {
      if (!line.trim()) return
      try {
        const parsed = JSON.parse(line) as { type: string; text?: string; code?: number }
        if (parsed.type === 'stdout' || parsed.type === 'stderr') {
          const textLines = (parsed.text ?? '').split('\n')
          for (const tl of textLines) {
            if (tl !== '' || textLines.length === 1) addLine(parsed.type as 'stdout' | 'stderr', tl)
          }
        } else if (parsed.type === 'exit') {
          setExitCode(parsed.code ?? 0)
          addLine('exit', `Exit: ${parsed.code ?? 0}`, parsed.code ?? 0)
        } else if (parsed.type === 'error') {
          addLine('error', parsed.text ?? 'Unknown error')
        }
      } catch { /* skip malformed */ }
    }

    try {
      const res = await fetch(
        `${DAEMON}/repo/run?cmd=${encodeURIComponent(selectedCmd)}`,
        { signal: abortRef.current.signal },
      )

      if (!res.ok) {
        // Non-200: daemon returned a JSON error object, not a stream
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const part of parts) processNdjsonLine(part)
      }

      // Flush anything left in the buffer that had no trailing newline
      if (buf.trim()) processNdjsonLine(buf)

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        addLine('info', '(cancelled)')
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('Failed to fetch')) {
          addLine('error', 'Daemon offline — run: npm run bertos:daemon')
        } else {
          addLine('error', msg)
        }
      }
    } finally {
      clearTimeout(timeoutId)
      setRunning(false)
    }
  }, [selectedCmd, running, addLine])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleClear = useCallback(() => {
    setLines([])
    setExitCode(null)
  }, [])

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/50">
        <Terminal className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex-shrink-0">Terminal</span>

        <div className="relative flex-1 min-w-0">
          <select
            value={selectedCmd}
            onChange={e => setSelectedCmd(e.target.value)}
            disabled={running}
            className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 px-2.5 py-1.5 pr-7 outline-none focus:border-violet-500/60 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {SAFE_COMMANDS.map(c => (
              <option key={c.cmd} value={c.cmd}>{c.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        {running ? (
          <Button size="sm" variant="destructive" onClick={handleStop} className="flex-shrink-0">
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={handleRun} className="flex-shrink-0">
            <Play className="w-3 h-3" /> Run
          </Button>
        )}

        {lines.length > 0 && !running && (
          <button
            onClick={handleClear}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
          >
            Clear
          </button>
        )}

        {/* Exit code badge */}
        {exitCode !== null && !running && (
          <div className={cn(
            'flex items-center gap-1 text-[10px] flex-shrink-0',
            exitCode === 0 ? 'text-emerald-400' : 'text-red-400',
          )}>
            {exitCode === 0
              ? <CheckCircle2 className="w-3 h-3" />
              : <XCircle className="w-3 h-3" />}
            {exitCode === 0 ? 'OK' : `Exit ${exitCode}`}
          </div>
        )}
      </div>

      {/* Output */}
      <ScrollArea className="flex-1">
        <div className="p-3 font-mono text-xs space-y-0">
          {lines.length === 0 && !running && (
            <div className="text-zinc-700 py-4 text-center text-[11px]">
              Select a command and press Run
            </div>
          )}
          {lines.map(line => (
            <div
              key={line.id}
              className={cn(
                'leading-5 whitespace-pre-wrap break-all',
                line.type === 'info'   && 'text-emerald-400',
                line.type === 'stdout' && 'text-zinc-300',
                line.type === 'stderr' && 'text-amber-300',
                line.type === 'error'  && 'text-red-400',
                line.type === 'exit'   && (line.code === 0 ? 'text-emerald-400 mt-1' : 'text-red-400 mt-1'),
              )}
            >
              {line.text}
            </div>
          ))}
          {running && (
            <div className="text-violet-400 animate-pulse">▊</div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Safe-mode notice */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-zinc-800/40 bg-zinc-950/40">
        <p className="text-[9px] text-zinc-700">
          Safe mode — only allowlisted commands. Never auto-pushes.
        </p>
      </div>
    </div>
  )
}
