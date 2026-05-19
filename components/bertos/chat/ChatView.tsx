'use client'
import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Sparkles, Cpu, Zap, Globe, ArrowDown } from 'lucide-react'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { useProjectStore } from '@/store/bertos/projects'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { routePrompt } from '@/lib/bertos/router'
import type { AIModel } from '@/lib/bertos/types'
import { useState } from 'react'

const WELCOME_PROMPTS = [
  { icon: <Cpu className="w-4 h-4 text-violet-400" />, label: 'Explain async/await in TypeScript', model: 'codex' as AIModel },
  { icon: <Sparkles className="w-4 h-4 text-amber-400" />, label: 'What is the best AI stack for 2025?', model: 'auto' as AIModel },
  { icon: <Globe className="w-4 h-4 text-blue-400" />, label: 'Research the latest in LLM architecture', model: 'gemini' as AIModel },
  { icon: <Zap className="w-4 h-4 text-emerald-400" />, label: 'Build a React hook for local storage', model: 'codex' as AIModel },
]

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
  const scrollRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    scrollToBottom(false)
  }, [session?.id, scrollToBottom])

  useEffect(() => {
    if (isStreaming) scrollToBottom()
  }, [messages.length, isStreaming, scrollToBottom])

  const sendMessage = useCallback(async (content: string) => {
    let sessionId = activeSessionId
    if (!sessionId) {
      const s = createSession(selectedModel)
      sessionId = s.id
    }

    const userMsg = addMessage(sessionId, { role: 'user', content })

    if (messages.length === 0) {
      const title = content.length > 50 ? content.slice(0, 50) + '…' : content
      updateSessionTitle(sessionId, title)
    }

    const aiMsg = addMessage(sessionId, {
      role: 'assistant',
      content: '',
      model: selectedModel,
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
      let routerDecision = null
      const startTime = Date.now()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'chunk') {
              appendToMessage(sessionId!, aiMsg.id, data.content)
            } else if (data.type === 'router') {
              routerDecision = data.decision
            } else if (data.type === 'done') {
              const latency = Date.now() - startTime
              updateMessage(sessionId!, aiMsg.id, {
                streaming: false,
                routerDecision,
                model: routerDecision?.primary ?? selectedModel,
                metadata: { latency },
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        updateMessage(sessionId!, aiMsg.id, {
          content: 'An error occurred. Please check your API configuration.',
          streaming: false,
        })
      }
    } finally {
      setStreaming(false)
    }
  }, [activeSessionId, selectedModel, addMessage, appendToMessage, updateMessage, setStreaming, createSession, updateSessionTitle, getActiveProject, messages.length])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
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
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8"
            >
              {/* Logo/Hero */}
              <div className="space-y-4">
                <div className="relative inline-flex">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-[0_0_60px_rgba(139,92,246,0.4)]">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-4 border-[#0A0A0B] flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-200" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
                    Welcome to{' '}
                    <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                      BertOS
                    </span>
                  </h1>
                  <p className="text-zinc-500 mt-1.5 text-sm max-w-sm">
                    Your AI command center. Control Claude, Codex, and Gemini from one unified workspace.
                  </p>
                </div>
              </div>

              {/* Quick prompts */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {WELCOME_PROMPTS.map((p, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    onClick={() => sendMessage(p.label)}
                    className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 p-3 text-left transition-all duration-150 group"
                  >
                    <span className="flex-shrink-0">{p.icon}</span>
                    <span className="text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors leading-snug">
                      {p.label}
                    </span>
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-zinc-700">
                <kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd>
                <span>Command palette</span>
                <span className="mx-1">·</span>
                <kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px]">/</kbd>
                <span>Slash commands</span>
              </div>
            </motion.div>
          ) : (
            <div className="py-6 space-y-6">
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={isStreaming && msg.streaming}
                  />
                ))}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
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
