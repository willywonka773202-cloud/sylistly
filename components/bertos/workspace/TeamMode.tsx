'use client'
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Cpu, Zap, Bot, ArrowRight, ChevronDown, ChevronUp,
  Play, Square, Check, AlertTriangle, RefreshCw, Copy, FileCode2
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

type PipelineState = 'idle' | 'planning' | 'architecting' | 'implementing' | 'reviewing' | 'done'
type StepStatus = 'waiting' | 'active' | 'done' | 'error' | 'skipped'

interface StepResult {
  status: StepStatus
  output: string
  error?: string
}

interface TeamModeProps {
  task?: string
  fileContext?: string
  onPatchReady: (patch: string) => void
}

const PROVIDERS = [
  {
    id: 'planning',
    model: 'gemini-cli',
    label: 'Gemini CLI',
    role: 'Planner',
    color: '#3B82F6',
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/5',
    ringColor: 'ring-blue-500/40',
    icon: Globe,
    iconColor: 'text-blue-400',
    badgeVariant: 'gemini-cli' as const,
  },
  {
    id: 'architecting',
    model: 'claude-code',
    label: 'Claude Code',
    role: 'Architect',
    color: '#8B5CF6',
    borderColor: 'border-violet-500/40',
    bgColor: 'bg-violet-500/5',
    ringColor: 'ring-violet-500/40',
    icon: Cpu,
    iconColor: 'text-violet-400',
    badgeVariant: 'claude-code' as const,
  },
  {
    id: 'implementing',
    model: 'codex-cli',
    label: 'Codex CLI',
    role: 'Implementer',
    color: '#10B981',
    borderColor: 'border-emerald-500/40',
    bgColor: 'bg-emerald-500/5',
    ringColor: 'ring-emerald-500/40',
    icon: Zap,
    iconColor: 'text-emerald-400',
    badgeVariant: 'codex-cli' as const,
  },
  {
    id: 'reviewing',
    model: 'ollama-pro',
    label: 'Ollama Pro',
    role: 'Reviewer',
    color: '#F97316',
    borderColor: 'border-orange-500/40',
    bgColor: 'bg-orange-500/5',
    ringColor: 'ring-orange-500/40',
    icon: Bot,
    iconColor: 'text-orange-400',
    badgeVariant: 'ollama-pro' as const,
  },
]

const STATE_TO_INDEX: Record<PipelineState, number> = {
  idle: -1,
  planning: 0,
  architecting: 1,
  implementing: 2,
  reviewing: 3,
  done: 4,
}

function collectSseText(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  return new Promise(async (resolve) => {
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { resolve(text); return }
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.error) { resolve(`[ERROR] ${parsed.error}`); return }
            if (parsed.text) text += parsed.text
          } catch { /* skip */ }
        }
      }
    } catch { /* ignore */ }
    resolve(text)
  })
}

export function TeamMode({ task: taskProp, fileContext, onPatchReady }: TeamModeProps) {
  const [taskInput, setTaskInput] = useState(taskProp ?? '')
  const [pipelineState, setPipelineState] = useState<PipelineState>('idle')
  const [steps, setSteps] = useState<Record<string, StepResult>>({
    planning:     { status: 'waiting', output: '' },
    architecting: { status: 'waiting', output: '' },
    implementing: { status: 'waiting', output: '' },
    reviewing:    { status: 'waiting', output: '' },
  })
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const setStep = useCallback((id: string, updates: Partial<StepResult>) => {
    setSteps(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }))
  }, [])

  const toggleExpand = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const callProvider = async (
    model: string,
    prompt: string,
    abort: AbortSignal,
  ): Promise<string> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abort,
      body: JSON.stringify({
        model,
        prompt,
        systemPrompt: 'You are part of BertOS Team Mode, a multi-agent pipeline. Respond concisely and precisely.',
      }),
    })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    return collectSseText(res.body.getReader())
  }

  const runStep = async (
    stepId: string,
    model: string,
    prompt: string,
    abort: AbortSignal,
    fallbackModel = 'ollama-pro',
  ): Promise<string> => {
    setStep(stepId, { status: 'active', output: '', error: undefined })
    try {
      const result = await callProvider(model, prompt, abort)
      if (result.startsWith('[ERROR]')) {
        // Try fallback
        setStep(stepId, {
          output: `[Using Ollama fallback — original provider not available]\n`,
          error: `Provider ${model} not available, using fallback`,
        })
        const fallback = await callProvider(fallbackModel, prompt, abort)
        setStep(stepId, { status: 'done', output: `[Fallback: ${fallbackModel}]\n${fallback}` })
        return fallback
      }
      setStep(stepId, { status: 'done', output: result })
      return result
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      const msg = err instanceof Error ? err.message : String(err)
      setStep(stepId, { status: 'error', error: msg, output: '' })
      throw err
    }
  }

  const startPipeline = async () => {
    const task = taskInput.trim()
    if (!task) return
    abortRef.current = new AbortController()
    const abort = abortRef.current.signal

    setSteps({
      planning:     { status: 'waiting', output: '' },
      architecting: { status: 'waiting', output: '' },
      implementing: { status: 'waiting', output: '' },
      reviewing:    { status: 'waiting', output: '' },
    })
    setExpandedSteps(new Set(['planning']))

    try {
      // Step 1: Plan
      setPipelineState('planning')
      const plan = await runStep(
        'planning',
        'gemini-cli',
        `Create a step-by-step plan for: ${task}\nFile context: ${fileContext ?? 'none provided'}`,
        abort,
      )

      // Step 2: Architect
      setPipelineState('architecting')
      setExpandedSteps(prev => new Set([...prev, 'architecting']))
      const arch = await runStep(
        'architecting',
        'claude-code',
        `Given this plan:\n${plan}\n\nDesign the architecture and key changes needed.`,
        abort,
      )

      // Step 3: Implement
      setPipelineState('implementing')
      setExpandedSteps(prev => new Set([...prev, 'implementing']))
      const patch = await runStep(
        'implementing',
        'codex-cli',
        `Given this architecture:\n${arch}\n\nImplement the changes as a unified diff patch.`,
        abort,
      )

      // Step 4: Review
      setPipelineState('reviewing')
      setExpandedSteps(prev => new Set([...prev, 'reviewing']))
      await runStep(
        'reviewing',
        'ollama-pro',
        `Review this patch:\n${patch}\n\nIdentify issues and suggest improvements.`,
        abort,
      )

      setPipelineState('done')
      onPatchReady(patch)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[TeamMode] Pipeline error:', err)
      }
    }
  }

  const stopPipeline = () => {
    abortRef.current?.abort()
    setPipelineState('idle')
    setSteps(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (next[key].status === 'active') next[key] = { ...next[key], status: 'waiting' }
      }
      return next
    })
  }

  const skipToNext = (stepId: string) => {
    setStep(stepId, { status: 'skipped', output: '[Skipped by user]' })
  }

  const copyPatch = () => {
    const patch = steps.implementing.output
    navigator.clipboard.writeText(patch).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const activeIndex = STATE_TO_INDEX[pipelineState]
  const finalPatch = steps.implementing.output.replace(/^\[.*?\]\n/, '')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-zinc-800/50 bg-zinc-950/40">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-zinc-700/50 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Team Mode</h2>
            <p className="text-[11px] text-zinc-500">Multi-model orchestration pipeline</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pipelineState !== 'idle' && pipelineState !== 'done' && (
              <Button size="sm" variant="destructive" onClick={stopPipeline}>
                <Square className="w-3 h-3" />
                Stop
              </Button>
            )}
            {(pipelineState === 'idle' || pipelineState === 'done') && (
              <Button
                size="sm"
                onClick={startPipeline}
                disabled={!taskInput.trim()}
              >
                <Play className="w-3 h-3" />
                {pipelineState === 'done' ? 'Run Again' : 'Start Pipeline'}
              </Button>
            )}
          </div>
        </div>

        {/* Task input */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 focus-within:border-zinc-700 transition-colors">
          <FileCode2 className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
          <input
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pipelineState === 'idle' && startPipeline()}
            placeholder="Describe the coding task: e.g. Add input validation to the user registration form"
            disabled={pipelineState !== 'idle' && pipelineState !== 'done'}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none disabled:opacity-60"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-3 max-w-4xl mx-auto">

          {/* Pipeline visualization */}
          <div className="flex items-start gap-1">
            {PROVIDERS.map((p, idx) => {
              const step = steps[p.id]
              const isActive = pipelineState === p.id
              const isDone = step.status === 'done' || step.status === 'skipped'
              const isError = step.status === 'error'
              const expanded = expandedSteps.has(p.id)

              return (
                <div key={p.id} className="flex items-start flex-1 min-w-0">
                  {/* Card */}
                  <motion.div
                    className={cn(
                      'flex-1 rounded-xl border p-3 transition-all duration-300 min-w-0',
                      isActive && `${p.borderColor} ${p.bgColor} ring-1 ${p.ringColor}`,
                      isDone && !isActive && 'border-zinc-700/50 bg-zinc-900/30',
                      isError && 'border-red-500/30 bg-red-500/5',
                      !isActive && !isDone && !isError && 'border-zinc-800 bg-zinc-900/20',
                    )}
                    animate={isActive ? {
                      boxShadow: [
                        `0 0 0px 0px ${p.color}20`,
                        `0 0 12px 2px ${p.color}30`,
                        `0 0 0px 0px ${p.color}20`,
                      ],
                    } : {}}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <p.icon className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? p.iconColor : isDone ? 'text-zinc-500' : 'text-zinc-700')} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[11px] font-semibold truncate', isActive ? 'text-zinc-200' : isDone ? 'text-zinc-400' : 'text-zinc-600')}>
                          {p.label}
                        </p>
                        <p className="text-[9px] text-zinc-600 truncate">{p.role}</p>
                      </div>
                      <StepStatusIcon status={step.status} color={p.color} />
                    </div>

                    {/* Output preview */}
                    {(step.output || step.error) && (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className="flex items-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                          {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          {expanded ? 'Collapse' : 'Expand'}
                        </button>

                        <AnimatePresence>
                          {expanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="rounded-lg bg-zinc-950 border border-zinc-800/50 p-2 max-h-48 overflow-y-auto">
                                {step.error && !step.output && (
                                  <div className="flex items-start gap-1.5 mb-1.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-amber-400/80">{step.error}</p>
                                  </div>
                                )}
                                {step.error && step.output && (
                                  <p className="text-[9px] text-amber-400/70 mb-1">{step.error}</p>
                                )}
                                <pre className="text-[10px] text-zinc-400 font-mono whitespace-pre-wrap leading-relaxed">
                                  {step.output || <span className="text-zinc-700 italic">No output yet</span>}
                                </pre>
                              </div>

                              {isError && (
                                <button
                                  onClick={() => skipToNext(p.id)}
                                  className="mt-1 text-[9px] text-amber-400 hover:text-amber-300 transition-colors"
                                >
                                  Skip to next →
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {!expanded && step.output && (
                          <p className="text-[9px] text-zinc-600 font-mono truncate">
                            {step.output.replace(/\n/g, ' ').slice(0, 60)}…
                          </p>
                        )}
                      </div>
                    )}

                    {isActive && !step.output && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <RefreshCw className="w-2.5 h-2.5 text-zinc-600 animate-spin" />
                        <span className="text-[9px] text-zinc-600">Processing…</span>
                      </div>
                    )}
                  </motion.div>

                  {/* Arrow connector */}
                  {idx < PROVIDERS.length - 1 && (
                    <div className="flex items-center px-1 flex-shrink-0 mt-4">
                      <ArrowRight className={cn(
                        'w-3 h-3 transition-colors',
                        activeIndex > idx ? 'text-zinc-500' : 'text-zinc-800'
                      )} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Final result panel */}
          <AnimatePresence>
            {pipelineState === 'done' && steps.implementing.status === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-200">Pipeline Complete</h3>
                    <Badge variant="success" className="text-[9px] h-4">Ready</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyPatch}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy Patch'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onPatchReady(finalPatch)}
                    >
                      <FileCode2 className="w-3 h-3" />
                      Create Patch
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-zinc-500">
                  The implementer produced the patch below. Reviewed by Ollama Pro. Approve to apply.
                </p>
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
                    <FileCode2 className="w-3 h-3 text-zinc-600" />
                    <span className="text-[10px] text-zinc-600 font-mono">patch.diff</span>
                  </div>
                  <pre className="p-3 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                    {finalPatch || 'No patch generated — provider may not have returned a diff.'}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Idle empty state */}
          {pipelineState === 'idle' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex items-center gap-2 mb-4 opacity-30">
                {PROVIDERS.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <div className="w-7 h-7 rounded-lg border border-zinc-700 flex items-center justify-center">
                      <p.icon className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                    {i < PROVIDERS.length - 1 && <ArrowRight className="w-3 h-3 text-zinc-800" />}
                  </div>
                ))}
              </div>
              <p className="text-sm text-zinc-600">Describe a task above and click Start Pipeline</p>
              <p className="text-xs text-zinc-700 mt-1">
                Gemini plans → Claude architects → Codex implements → Ollama reviews
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function StepStatusIcon({ status, color }: { status: StepStatus; color: string }) {
  if (status === 'active') {
    return <RefreshCw className="w-3 h-3 animate-spin text-zinc-500 flex-shrink-0" />
  }
  if (status === 'done') {
    return <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
  }
  if (status === 'error') {
    return <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
  }
  if (status === 'skipped') {
    return <span className="text-[8px] text-zinc-600 flex-shrink-0">SKIP</span>
  }
  return <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 flex-shrink-0" style={status === 'waiting' ? {} : { backgroundColor: color }} />
}
