'use client'
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import React from 'react'
import { GitCompare, Send, Cpu, Globe, Zap, Trophy, Copy, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getModelColor } from '@/lib/bertos/router'
import type { AIModel } from '@/lib/bertos/types'

interface ModelResponse {
  model: AIModel
  content: string
  streaming: boolean
  done: boolean
  latency?: number
  error?: string
}

const MODELS: AIModel[] = ['claude', 'codex', 'gemini']

const MODEL_META: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  claude: { label: 'Claude', icon: <Cpu className="w-4 h-4" />, color: '#8B5CF6', desc: 'Anthropic' },
  codex: { label: 'Codex', icon: <Zap className="w-4 h-4" />, color: '#10B981', desc: 'OpenAI' },
  gemini: { label: 'Gemini', icon: <Globe className="w-4 h-4" />, color: '#3B82F6', desc: 'Google' },
  auto: { label: 'Auto', icon: <Zap className="w-4 h-4" />, color: '#F59E0B', desc: 'Router' },
}

const COMPARE_PROMPTS = [
  'Explain the concept of recursion with a practical example',
  'What is the best approach to state management in React?',
  'How would you design a distributed cache?',
  'Write a creative short story about AI and humanity',
]

export function CompareView() {
  const [query, setQuery] = useState('')
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [winner, setWinner] = useState<AIModel | null>(null)
  const [copiedModel, setCopiedModel] = useState<AIModel | null>(null)
  const abortRefs = useRef<Map<AIModel, AbortController>>(new Map())

  const runComparison = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isRunning) return

    setIsRunning(true)
    setWinner(null)
    const initial: ModelResponse[] = MODELS.map(m => ({
      model: m, content: '', streaming: true, done: false,
    }))
    setResponses(initial)

    abortRefs.current.forEach(c => c.abort())
    abortRefs.current.clear()

    const startTimes: Record<string, number> = {}

    await Promise.all(MODELS.map(async (model) => {
      const ctrl = new AbortController()
      abortRefs.current.set(model, ctrl)
      startTimes[model] = Date.now()

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ id: '1', role: 'user', content: prompt, timestamp: Date.now() }],
            model,
            sessionId: 'compare',
          }),
          signal: ctrl.signal,
        })

        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const lines = decoder.decode(value).split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'chunk') {
                setResponses(prev =>
                  prev.map(r => r.model === model ? { ...r, content: r.content + data.content } : r)
                )
              } else if (data.type === 'done') {
                const latency = Date.now() - startTimes[model]
                setResponses(prev =>
                  prev.map(r => r.model === model ? { ...r, streaming: false, done: true, latency } : r)
                )
              }
            } catch {}
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResponses(prev =>
            prev.map(r => r.model === model ? { ...r, streaming: false, done: true, error: 'Failed to get response' } : r)
          )
        }
      }
    }))

    setIsRunning(false)
  }, [isRunning])

  const copy = (model: AIModel) => {
    const r = responses.find(r => r.model === model)
    if (r) {
      navigator.clipboard.writeText(r.content)
      setCopiedModel(model)
      setTimeout(() => setCopiedModel(null), 2000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-zinc-800 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Multi-AI Compare</h2>
              <p className="text-[11px] text-zinc-500">Ask all models simultaneously and compare responses</p>
            </div>
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runComparison(query)}
              placeholder="Ask all AI systems the same question..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-700 focus:shadow-[0_0_0_1px_rgba(139,92,246,0.2)] transition-all"
            />
            <Button
              onClick={() => runComparison(query)}
              disabled={!query.trim() || isRunning}
              className="flex-shrink-0"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isRunning ? 'Running...' : 'Compare All'}
            </Button>
          </div>

          {/* Quick prompts */}
          {responses.length === 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {COMPARE_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(p); runComparison(p) }}
                  className="text-[11px] px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
                >
                  {p.length > 45 ? p.slice(0, 45) + '…' : p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comparison columns */}
      <div className="flex-1 overflow-hidden">
        {responses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GitCompare className="w-12 h-12 text-zinc-800 mb-3" />
            <p className="text-zinc-600 text-sm">Enter a prompt above to compare all AI models simultaneously</p>
            <p className="text-zinc-700 text-xs mt-1">Responses stream in parallel</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 h-full divide-x divide-zinc-800/50">
            {responses.map(response => {
              const meta = MODEL_META[response.model]
              return (
                <div key={response.model} className="flex flex-col h-full overflow-hidden">
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                    style={{ borderColor: `${meta.color}20`, background: `${meta.color}08` }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: meta.color }}>{meta.icon}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: meta.color }}>
                          {meta.label}
                        </p>
                        <p className="text-[10px] text-zinc-600">{meta.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {response.done && response.latency && (
                        <span className="text-[10px] text-zinc-600">{response.latency}ms</span>
                      )}
                      {response.streaming && (
                        <div className="flex gap-0.5">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              animate={{ scaleY: [1, 2, 1] }}
                              transition={{ duration: 0.5, delay: i * 0.1, repeat: Infinity }}
                              className="w-0.5 h-2 rounded-full"
                              style={{ background: meta.color }}
                            />
                          ))}
                        </div>
                      )}
                      {response.done && (
                        <>
                          <button
                            onClick={() => copy(response.model)}
                            className="p-1 rounded hover:bg-white/5 transition-colors"
                          >
                            {copiedModel === response.model ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-zinc-600" />
                            )}
                          </button>
                          <button
                            onClick={() => setWinner(response.model)}
                            className={cn(
                              'p-1 rounded hover:bg-white/5 transition-colors',
                              winner === response.model ? 'text-amber-400' : 'text-zinc-600'
                            )}
                          >
                            <Trophy className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-4 text-sm text-zinc-300 leading-relaxed">
                    {winner === response.model && (
                      <div className="flex items-center gap-1.5 mb-3 text-amber-400 text-xs font-medium">
                        <Trophy className="w-3.5 h-3.5" />
                        Best Answer
                      </div>
                    )}
                    {response.error ? (
                      <p className="text-red-400 text-sm">{response.error}</p>
                    ) : (
                      <>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ className, children }) {
                              const isBlock = className?.includes('language-')
                              if (isBlock) {
                                return (
                                  <pre className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 overflow-x-auto text-xs my-3">
                                    <code>{children}</code>
                                  </pre>
                                )
                              }
                              return (
                                <code className="bg-zinc-800 text-violet-300 px-1 py-0.5 rounded text-xs font-mono">
                                  {children}
                                </code>
                              )
                            },
                            pre({ children }) { return <>{children}</> },
                            p({ children }) { return <p className="mb-3 last:mb-0">{children}</p> },
                            ul({ children }) { return <ul className="mb-3 pl-4 space-y-1 list-disc">{children}</ul> },
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
                            className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom"
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
        )}
      </div>
    </div>
  )
}
