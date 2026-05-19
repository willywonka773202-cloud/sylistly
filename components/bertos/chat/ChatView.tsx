'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Cpu, Zap, Globe, ArrowDown } from 'lucide-react'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { useProjectStore } from '@/store/bertos/projects'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { RouterBadge } from './RouterBadge'
import { readAIStream } from '@/lib/bertos/stream-utils'
import type { AIModel, RouterDecision } from '@/lib/bertos/types'

const WELCOME_PROMPTS = [
  { icon: <Cpu className="w-4 h-4 text-violet-400" />, label: 'Explain async/await in TypeScript with examples' },
  { icon: <Sparkles className="w-4 h-4 text-amber-400" />, label: 'What is the best AI stack for a startup in 2025?' },
  { icon: <Globe className="w-4 h-4 text-blue-400" />, label: 'Research the latest breakthroughs in LLM architecture' },
  { icon: <Zap className="w-4 h-4 text-emerald-400" />, label: 'Build a React hook for debounced localStorage sync' },
  { icon: <Cpu className="w-4 h-4 text-violet-400" />, label: 'Write a compelling product roadmap for an AI startup' },
  { icon: <Globe className="w-4 h-4 text-blue-400" />, label: 'Compare REST vs GraphQL vs tRPC for a Next.js app' },
]

function SkeletonMessage() {
  return (
    <div className="flex gap-3 py-2">
      <div className="w-7 h-7 rounded-lg bg-zinc-800 flex-shrink-0 mt-0.5 animate-pulse" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-zinc-800 rounded-full w-20 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-2.5 bg-zinc-800/70 rounded-full w-full animate-pulse" />
          <div className="h-2.5 bg-zinc-800/60 rounded-full w-4/5 animate-pulse" style={{ animationDelay: '0.1s' }} />
          <div className="h-2.5 bg-zinc-800/40 rounded-full w-3/5 animate-pulse" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  )
}

export function ChatView() {
  const {
    sessions, activeSessionId, isStreaming,
    createSession, addMessage, appendToMessage, updateMessage,
    setStreaming, updateSessionTitle, getActiveSession,
  } = useChatStore()
  const { selectedModel, settings } = useUIStore()
  const { getActiveProject } = useProjectStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<RouterDecision | null>(null)

  const session = getActiveSession()
  const messages = session?.messages ?? []

  // Bootstrap first session
  useEffect(() => {
    if (!activeSessionId) {
      if (sessions.length > 0) {
        useChatStore.getState().setActiveSession(sessions[0].id)
      } else {
        createSession(selectedModel)
      }
    }
  }, [activeSessionId, sessions, createSession, selectedModel])

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => { scrollToBottom(false) }, [session?.id, scrollToBottom])
  useEffect(() => { if (isStreaming) scrollToBottom() }, [messages.length, isStreaming, scrollToBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    // Ensure active session
    let sessionId = activeSessionId
    if (!sessionId) {
      const s = createSession(selectedModel)
      sessionId = s.id
    }

    addMessage(sessionId, { role: 'user', content })
    if (messages.length === 0) {
      updateSessionTitle(sessionId, content.length > 50 ? content.slice(0, 50) + '…' : content)
    }

    // Create the streaming placeholder
    const aiMsg = addMessage(sessionId, { role: 'assistant', content: '', model: selectedModel, streaming: true })
    setStreaming(true, aiMsg.id)
    abortRef.current = new AbortController()

    const project = getActiveProject()
    const systemPrompt = [
      'You are BertOS, an advanced AI assistant inside the BertOS AI operating system. Be precise, helpful, and thorough.',
      project?.context ? `Project context: ${project.context}` : '',
    ].filter(Boolean).join('\n\n')

    const allMessages = useChatStore.getState()
      .sessions.find(s => s.id === sessionId)
      ?.messages.filter(m => m.id !== aiMsg.id) ?? []

    const startTime = Date.now()
    let resolvedModel = selectedModel as string

    // Inner helper: stream a single model into the existing aiMsg bubble
    const doStream = async (modelId: string): Promise<RouterDecision | null> => {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          model: modelId,
          systemPrompt,
          clientKeys: settings.apiKeys,
          ollamaEndpoint: settings.ollamaEndpoint,
        }),
        signal: abortRef.current?.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      let routerDecision: RouterDecision | null = null
      let hasFirstChunk = false

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
            const parsed = JSON.parse(raw) as {
              text?: string
              routerDecision?: RouterDecision
              error?: string
            }

            if (parsed.routerDecision) {
              routerDecision = parsed.routerDecision
              if (selectedModel === 'auto') setPendingDecision(parsed.routerDecision)
            }

            if (parsed.error) throw new Error(parsed.error)

            if (parsed.text) {
              if (!hasFirstChunk) {
                hasFirstChunk = true
                setPendingDecision(null)
              }
              appendToMessage(sessionId!, aiMsg.id, parsed.text)
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') throw parseErr
          }
        }
      }

      return routerDecision
    }

    const OLLAMA_MODEL_IDS = new Set(['llama3', 'llama3.2', 'mistral', 'deepseek-coder', 'hermes3'])

    const isQuotaError = (err: Error) => {
      const m = err.message.toLowerCase()
      return m.includes('429') || m.includes('quota') || m.includes('billing') || m.includes('rate limit')
    }

    // Pre-flight: Ollama models MUST use a private endpoint — never hit public cloud
    const requirePrivateEndpoint = (modelId: string) => {
      if (OLLAMA_MODEL_IDS.has(modelId) && !settings.ollamaEndpoint?.trim()) {
        throw new Error(
          `No private endpoint configured. Set your VPS URL in Settings → API Keys → Custom Ollama Endpoint to use ${modelId}.`
        )
      }
    }

    try {
      // For 'auto' mode, call the router first to get model + show badge
      if (selectedModel === 'auto') {
        try {
          const routerRes = await fetch('/api/router', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: content }),
            signal: abortRef.current.signal,
          })
          const decision: RouterDecision = await routerRes.json()
          resolvedModel = decision.primary
          setPendingDecision(decision)
          updateMessage(sessionId, aiMsg.id, { model: decision.primary as AIModel })
        } catch {
          resolvedModel = 'claude'
        }
      }

      requirePrivateEndpoint(resolvedModel)
      const routerDecision = await doStream(resolvedModel)
      updateMessage(sessionId!, aiMsg.id, {
        streaming: false,
        routerDecision: routerDecision ?? undefined,
        model: (routerDecision?.primary ?? resolvedModel) as AIModel,
        metadata: { latency: Date.now() - startTime },
      })
    } catch (err) {
      setPendingDecision(null)
      if ((err as Error).name === 'AbortError') {
        // user cancelled — leave partial content, just stop streaming
        updateMessage(sessionId!, aiMsg.id, { streaming: false })
      } else if (isQuotaError(err as Error) && resolvedModel !== 'llama3') {
        // Waterfall: quota exceeded → retry with Llama 3 on the private VPS
        if (!settings.ollamaEndpoint?.trim()) {
          updateMessage(sessionId!, aiMsg.id, {
            content: `**Quota exceeded.** Set your private Ollama endpoint in **Settings → API Keys → Custom Ollama Endpoint** to enable auto-fallback to Llama 3.`,
            streaming: false,
          })
        } else {
          const modelLabel = resolvedModel === 'codex' ? 'OpenAI' : resolvedModel === 'gemini' ? 'Google' : 'Anthropic'
          appendToMessage(sessionId!, aiMsg.id,
            `\n\n> ⚠️ **${modelLabel} quota exceeded.** Auto-routing to Llama 3 on your private VPS...\n\n`)
          updateMessage(sessionId!, aiMsg.id, { model: 'llama3' as AIModel, streaming: true })
          setStreaming(true, aiMsg.id)

          try {
            // requirePrivateEndpoint already checked above — endpoint is confirmed set
            await doStream('llama3')
            updateMessage(sessionId!, aiMsg.id, {
              streaming: false,
              metadata: { latency: Date.now() - startTime },
            })
          } catch (fallbackErr) {
            if ((fallbackErr as Error).name !== 'AbortError') {
              appendToMessage(sessionId!, aiMsg.id,
                `\n\n**VPS fallback error:** ${(fallbackErr as Error).message}`)
            }
            updateMessage(sessionId!, aiMsg.id, { streaming: false })
          }
        }
      } else {
        const isConfig = (err as Error).message?.includes('not configured') || (err as Error).message?.includes('API key')
        updateMessage(sessionId!, aiMsg.id, {
          content: isConfig
            ? `**API key not configured.** Go to **Settings → API Keys** to add your ${resolvedModel === 'codex' ? 'OpenAI' : resolvedModel === 'gemini' ? 'Google' : 'Anthropic'} key.`
            : `Stream error: ${(err as Error).message}`,
          streaming: false,
        })
      }
    } finally {
      setStreaming(false)
      setPendingDecision(null)
    }
  }, [
    activeSessionId, selectedModel, messages.length, settings.apiKeys,
    addMessage, appendToMessage, updateMessage, setStreaming,
    createSession, updateSessionTitle, getActiveProject,
  ])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setPendingDecision(null)
    const s = getActiveSession()
    if (s) {
      const last = s.messages[s.messages.length - 1]
      if (last?.streaming) updateMessage(s.id, last.id, { streaming: false })
    }
  }, [setStreaming, getActiveSession, updateMessage])

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8"
            >
              {/* Hero */}
              <div className="space-y-4">
                <div className="relative inline-flex">
                  <motion.div
                    animate={{ boxShadow: ['0 0 40px rgba(139,92,246,0.3)', '0 0 70px rgba(139,92,246,0.5)', '0 0 40px rgba(139,92,246,0.3)'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </motion.div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-4 border-[#0A0A0B]" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    <span className="text-zinc-100">How can </span>
                    <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">BertOS</span>
                    <span className="text-zinc-100"> help?</span>
                  </h1>
                  <p className="text-zinc-500 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
                    Claude, Codex, and Gemini — unified. The right AI for every task, automatically.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {WELCOME_PROMPTS.map((p, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.04 }}
                    onClick={() => sendMessage(p.label)}
                    className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 p-3 text-left transition-all duration-150 group"
                  >
                    <span className="flex-shrink-0">{p.icon}</span>
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors leading-snug">{p.label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-zinc-700">
                <div className="flex items-center gap-1.5"><kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd><span>Commands</span></div>
                <span className="text-zinc-800">·</span>
                <div className="flex items-center gap-1.5"><kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px]">/</kbd><span>Slash menu</span></div>
                <span className="text-zinc-800">·</span>
                <div className="flex items-center gap-1.5"><kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">⌘?</kbd><span>Shortcuts</span></div>
              </div>
            </motion.div>
          ) : (
            <div className="py-6 space-y-1">
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <div key={msg.id}>
                    {msg.role === 'assistant' && msg.routerDecision && !msg.streaming && (
                      <RouterBadge decision={msg.routerDecision} />
                    )}
                    <div className="py-2">
                      <MessageBubble message={msg} isStreaming={isStreaming && !!msg.streaming} />
                    </div>
                  </div>
                ))}
              </AnimatePresence>

              {/* Routing + skeleton while waiting for first token */}
              {pendingDecision && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <RouterBadge decision={pendingDecision} />
                  <SkeletonMessage />
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scrollToBottom()}
              className="fixed bottom-28 right-72 z-10 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 shadow-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Extra bottom padding on mobile so the fixed bottom nav doesn't cover the input */}
      <div className="flex-shrink-0 mb-16 md:mb-0">
        <InputBar onSubmit={sendMessage} onStop={handleStop} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
