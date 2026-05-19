'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Sparkles, Cpu, Zap, Globe, ArrowDown, Lightbulb } from 'lucide-react'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { useProjectStore } from '@/store/bertos/projects'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { RouterBadge } from './RouterBadge'
import { routePrompt } from '@/lib/bertos/router'
import type { AIModel, RouterDecision } from '@/lib/bertos/types'

const WELCOME_PROMPTS = [
  { icon: <Cpu className="w-4 h-4 text-violet-400" />, label: 'Explain async/await in TypeScript', model: 'codex' as AIModel },
  { icon: <Sparkles className="w-4 h-4 text-amber-400" />, label: 'What is the best AI stack for 2025?', model: 'auto' as AIModel },
  { icon: <Globe className="w-4 h-4 text-blue-400" />, label: 'Research the latest in LLM architecture', model: 'gemini' as AIModel },
  { icon: <Zap className="w-4 h-4 text-emerald-400" />, label: 'Build a React hook for local storage', model: 'codex' as AIModel },
  { icon: <Cpu className="w-4 h-4 text-violet-400" />, label: 'Write a product roadmap for an AI startup', model: 'claude' as AIModel },
  { icon: <Sparkles className="w-4 h-4 text-amber-400" />, label: 'Compare REST vs GraphQL vs tRPC', model: 'auto' as AIModel },
]

function SkeletonMessage() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-7 h-7 rounded-lg bg-zinc-800 flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-zinc-800 rounded-full w-16" />
        <div className="space-y-1.5">
          <div className="h-2.5 bg-zinc-800/70 rounded-full w-full" />
          <div className="h-2.5 bg-zinc-800/60 rounded-full w-4/5" />
          <div className="h-2.5 bg-zinc-800/50 rounded-full w-3/5" />
        </div>
      </div>
    </div>
  )
}

export function ChatView() {
  const {
    sessions, activeSessionId, isStreaming,
    createSession, addMessage, appendToMessage, updateMessage,
    setStreaming, updateSessionTitle, getActiveSession
  } = useChatStore()
  const { selectedModel } = useUIStore()
  const { getActiveProject } = useProjectStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<RouterDecision | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const session = getActiveSession()
  const messages = session?.messages ?? []

  useEffect(() => {
    if (!activeSessionId && sessions.length === 0) {
      createSession(selectedModel)
    } else if (!activeSessionId && sessions.length > 0) {
      useChatStore.getState().setActiveSession(sessions[0].id)
    }
  }, [activeSessionId, sessions, createSession, selectedModel])

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => { scrollToBottom(false) }, [session?.id, scrollToBottom])
  useEffect(() => { if (isStreaming) scrollToBottom() }, [messages.length, isStreaming, scrollToBottom])

  // Show scroll-to-bottom button when scrolled up
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const handler = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(dist > 300)
    }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    let sessionId = activeSessionId
    if (!sessionId) {
      const s = createSession(selectedModel)
      sessionId = s.id
    }

    addMessage(sessionId, { role: 'user', content })

    if (messages.length === 0) {
      const title = content.length > 50 ? content.slice(0, 50) + '…' : content
      updateSessionTitle(sessionId, title)
    }

    // Show routing animation before stream starts
    const preDecision = routePrompt(content, selectedModel)
    setPendingDecision(preDecision)

    const aiMsg = addMessage(sessionId, {
      role: 'assistant',
      content: '',
      model: preDecision.primary,
      streaming: true,
    })

    setStreaming(true, aiMsg.id)
    abortRef.current = new AbortController()

    const project = getActiveProject()
    const allMessages = [
      ...(project?.context ? [{ id: 'sys', role: 'system' as const, content: `Project context: ${project.context}`, timestamp: 0 }] : []),
      ...useChatStore.getState().sessions
        .find(s => s.id === sessionId)
        ?.messages.filter(m => m.id !== aiMsg.id) ?? [],
    ]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, model: selectedModel, sessionId }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let routerDecision: RouterDecision | null = null
      const startTime = Date.now()
      let hasContent = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'chunk') {
              if (!hasContent) {
                setPendingDecision(null)
                hasContent = true
              }
              appendToMessage(sessionId!, aiMsg.id, data.content)
            } else if (data.type === 'router') {
              routerDecision = data.decision
            } else if (data.type === 'done') {
              const latency = Date.now() - startTime
              updateMessage(sessionId!, aiMsg.id, {
                streaming: false,
                routerDecision: routerDecision ?? preDecision,
                model: routerDecision?.primary ?? preDecision.primary,
                metadata: { latency },
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      setPendingDecision(null)
      if ((err as Error).name !== 'AbortError') {
        updateMessage(sessionId!, aiMsg.id, {
          content: 'Something went wrong. Please check your API configuration in Settings.',
          streaming: false,
        })
      }
    } finally {
      setStreaming(false)
      setPendingDecision(null)
    }
  }, [activeSessionId, selectedModel, addMessage, appendToMessage, updateMessage, setStreaming, createSession, updateSessionTitle, getActiveProject, messages.length])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setPendingDecision(null)
    const session = getActiveSession()
    if (session) {
      const lastMsg = session.messages[session.messages.length - 1]
      if (lastMsg?.streaming) {
        updateMessage(session.id, lastMsg.id, { streaming: false })
      }
    }
  }, [setStreaming, getActiveSession, updateMessage])

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollContainerRef}>
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
                    <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
                      BertOS
                    </span>
                    <span className="text-zinc-100"> help?</span>
                  </h1>
                  <p className="text-zinc-500 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
                    Claude, Codex, and Gemini — unified. The right AI for every task, automatically.
                  </p>
                </div>
              </div>

              {/* Quick prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {WELCOME_PROMPTS.map((p, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.04 }}
                    onClick={() => sendMessage(p.label)}
                    className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-zinc-700 p-3 text-left transition-all duration-150 group"
                  >
                    <span className="flex-shrink-0">{p.icon}</span>
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors leading-snug">
                      {p.label}
                    </span>
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-zinc-700">
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd>
                  <span>Commands</span>
                </div>
                <span className="text-zinc-800">·</span>
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px]">/</kbd>
                  <span>Slash menu</span>
                </div>
                <span className="text-zinc-800">·</span>
                <div className="flex items-center gap-1.5">
                  <kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">↵</kbd>
                  <span>Send</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="py-6 space-y-1">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <div key={msg.id}>
                    {/* Router badge before first AI message after user input */}
                    {msg.role === 'assistant' && msg.routerDecision && !msg.streaming && (
                      <RouterBadge decision={msg.routerDecision} />
                    )}
                    <div className="py-2">
                      <MessageBubble
                        message={msg}
                        isStreaming={isStreaming && !!msg.streaming}
                      />
                    </div>
                  </div>
                ))}
              </AnimatePresence>

              {/* Pending routing decision while waiting for first chunk */}
              {pendingDecision && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <RouterBadge decision={pendingDecision} />
                  <div className="py-2">
                    <SkeletonMessage />
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scrollToBottom()}
              className="fixed bottom-28 right-72 z-10 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 shadow-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <InputBar
          onSubmit={sendMessage}
          onStop={handleStop}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  )
}
