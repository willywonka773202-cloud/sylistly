'use client'
import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitCompare, Send, Cpu, Globe, Zap, Trophy, Copy, Check, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { readAIStream } from '@/lib/bertos/stream-utils'
import type { AIModel } from '@/lib/bertos/types'

interface ModelResponse {
  model: AIModel
  content: string
  streaming: boolean
  done: boolean
  latency?: number
  error?: string
}

type ModelId = 'claude' | 'codex' | 'gemini'
const MODELS: ModelId[] = ['claude', 'codex', 'gemini']

const MODEL_META: Record<ModelId, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  claude: { label: 'Claude',  icon: <Cpu className="w-4 h-4" />,  color: '#8B5CF6', desc: 'Anthropic · Opus' },
  codex:  { label: 'Codex',   icon: <Zap className="w-4 h-4" />,  color: '#10B981', desc: 'OpenAI · GPT-4o' },
  gemini: { label: 'Gemini',  icon: <Globe className="w-4 h-4" />, color: '#3B82F6', desc: 'Google · Flash' },
}

const COMPARE_PROMPTS = [
  'Explain recursion with a practical real-world example',
  'What is the best approach to state management in React?',
  'How would you design a globally distributed cache?',
  'Write a short story about an AI that develops consciousness',
]

function StreamingBars({ color }: { color: string }) {
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ scaleY: [1, 2.5, 1] }}
          transition={{ duration: 0.55, delay: i * 0.12, repeat: Infinity }}
          className="w-0.5 h-2.5 rounded-full origin-bottom"
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

export function CompareView() {
  const [query, setQuery] = useState('')
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [winner, setWinner] = useState<ModelId | null>(null)
  const [copiedModel, setCopiedModel] = useState<ModelId | null>(null)
  const [activeTab, setActiveTab] = useState<ModelId>('claude')
  const abortRefs = useRef<Map<ModelId, AbortController>>(new Map())

  const patchResponse = useCallback((model: ModelId, patch: Partial<ModelResponse>) => {
    setResponses(prev => prev.map(r => r.model === model ? { ...r, ...patch } : r))
  }, [])

  const runComparison = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isRunning) return
    setIsRunning(true)
    setWinner(null)

    // Abort any in-flight requests
    abortRefs.current.forEach(c => c.abort())
    abortRefs.current.clear()

    // Initialize blank slots
    setResponses(MODELS.map(m => ({ model: m, content: '', streaming: true, done: false })))

    const results = await Promise.allSettled(
      MODELS.map(async (model) => {
        const ctrl = new AbortController()
        abortRefs.current.set(model, ctrl)
        const start = Date.now()

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ id: '1', role: 'user', content: prompt, timestamp: Date.now() }],
            model,
            systemPrompt: 'You are a helpful AI assistant. Be concise but complete.',
          }),
          signal: ctrl.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        // Parse SSE: skip routerDecision event, stream text chunks
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            const raw = trimmed.slice(6)
            if (raw === '[DONE]') break
            try {
              const parsed = JSON.parse(raw) as { text?: string; routerDecision?: unknown; error?: string }
              if (parsed.error) throw new Error(parsed.error)
              if (parsed.text) patchResponse(model, { content: undefined as never })
              if (parsed.text) {
                setResponses(prev =>
                  prev.map(r => r.model === model ? { ...r, content: r.content + parsed.text } : r)
                )
              }
            } catch {}
          }
        }

        patchResponse(model, { streaming: false, done: true, latency: Date.now() - start })
      })
    )

    // Surface errors from rejected promises
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const msg = (result.reason as Error).message
        const isConfig = msg.includes('not configured') || msg.includes('API key')
        patchResponse(MODELS[i], {
          streaming: false,
          done: true,
          error: isConfig ? 'API key not configured — add it in Settings.' : msg,
        })
      }
    })

    setIsRunning(false)
  }, [isRunning, patchResponse])

  const copy = (model: ModelId) => {
    const r = responses.find(r => r.model === model)
    if (r?.content) {
      navigator.clipboard.writeText(r.content)
      setCopiedModel(model)
      setTimeout(() => setCopiedModel(null), 2000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header / input */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50 bg-[#0A0A0B]/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Multi-AI Compare</h2>
              <p className="text-[11px] text-zinc-500">Stream all three models in parallel — pick the best answer</p>
            </div>
            {responses.length > 0 && !isRunning && (
              <button
                onClick={() => { setResponses([]); setQuery('') }}
                className="ml-auto flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runComparison(query)}
              placeholder="Ask all AI systems the same question…"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-700 focus:shadow-[0_0_0_1px_rgba(139,92,246,0.2)] transition-all"
            />
            <Button onClick={() => runComparison(query)} disabled={!query.trim() || isRunning} className="flex-shrink-0">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isRunning ? 'Streaming…' : 'Compare All'}
            </Button>
          </div>

          {responses.length === 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {COMPARE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(p); runComparison(p) }}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
                >
                  {p.length > 48 ? p.slice(0, 48) + '…' : p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {responses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="flex items-center gap-3">
              {MODELS.map(m => (
                <div key={m} className="w-10 h-10 rounded-xl border border-zinc-800 flex items-center justify-center" style={{ color: MODEL_META[m].color }}>
                  {MODEL_META[m].icon}
                </div>
              ))}
            </div>
            <p className="text-zinc-600 text-sm">Ask a question to stream all models simultaneously</p>
          </div>
        ) : (
          <>
            {/* Mobile tab bar */}
            <div className="md:hidden flex-shrink-0 flex border-b border-zinc-800/50 bg-zinc-950/60">
              {MODELS.map(m => {
                const meta = MODEL_META[m]
                const isActive = activeTab === m
                const resp = responses.find(r => r.model === m)
                return (
                  <button
                    key={m}
                    onClick={() => setActiveTab(m)}
                    className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative"
                    style={{ color: isActive ? meta.color : undefined }}
                  >
                    <span className={cn('transition-colors', isActive ? '' : 'text-zinc-600')}>{meta.icon}</span>
                    <span className="text-[10px] font-semibold">{meta.label}</span>
                    {resp?.streaming && <div className="absolute top-1.5 right-3 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color }} />}
                    {isActive && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: meta.color }} />}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 md:divide-x divide-zinc-800/50">
            {responses.map(response => {
              const meta = MODEL_META[response.model as ModelId]
              const isWinner = winner === response.model
              return (
                <div
                  key={response.model}
                  className={cn(
                    'flex flex-col h-full overflow-hidden',
                    // On mobile, only show the active tab
                    response.model !== activeTab && 'hidden md:flex'
                  )}
                >
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                    style={{ borderColor: `${meta.color}20`, background: `${meta.color}06` }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label}</p>
                        <p className="text-[10px] text-zinc-600">{meta.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {response.done && response.latency && (
                        <span className="text-[10px] text-zinc-700">{(response.latency / 1000).toFixed(1)}s</span>
                      )}
                      {response.streaming && <StreamingBars color={meta.color} />}
                      {response.done && (
                        <>
                          <button onClick={() => copy(response.model as ModelId)} className="p-1 rounded hover:bg-white/5 transition-colors">
                            {copiedModel === response.model
                              ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                              : <Copy className="w-3.5 h-3.5 text-zinc-600" />}
                          </button>
                          <button
                            onClick={() => setWinner(isWinner ? null : response.model as ModelId)}
                            className={cn('p-1 rounded hover:bg-white/5 transition-colors', isWinner ? 'text-amber-400' : 'text-zinc-700')}
                          >
                            <Trophy className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-4 text-sm text-zinc-300 leading-relaxed">
                    {isWinner && (
                      <div className="flex items-center gap-1.5 mb-3 text-amber-400 text-xs font-semibold">
                        <Trophy className="w-3.5 h-3.5" /> Best Answer
                      </div>
                    )}
                    {response.error ? (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <p className="text-red-400 text-sm">{response.error}</p>
                      </div>
                    ) : (
                      <>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ className, children }) {
                              const isBlock = className?.includes('language-')
                              if (isBlock) return (
                                <pre className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 overflow-x-auto text-xs my-3">
                                  <code>{children}</code>
                                </pre>
                              )
                              return <code className="bg-zinc-800 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                            },
                            pre({ children }) { return <>{children}</> },
                            p({ children }) { return <p className="mb-3 last:mb-0">{children}</p> },
                            ul({ children }) { return <ul className="mb-3 pl-4 space-y-1 list-disc marker:text-zinc-600">{children}</ul> },
                            ol({ children }) { return <ol className="mb-3 pl-4 space-y-1 list-decimal marker:text-zinc-600">{children}</ol> },
                            li({ children }) { return <li className="text-zinc-400">{children}</li> },
                            strong({ children }) { return <strong className="text-zinc-200 font-semibold">{children}</strong> },
                            h2({ children }) { return <h2 className="text-base font-bold text-zinc-100 mb-2 mt-4">{children}</h2> },
                            h3({ children }) { return <h3 className="text-sm font-semibold text-zinc-200 mb-1 mt-3">{children}</h3> },
                          }}
                        >
                          {response.content}
                        </ReactMarkdown>
                        {response.streaming && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                            className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom rounded-full"
                            style={{ background: meta.color }}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
