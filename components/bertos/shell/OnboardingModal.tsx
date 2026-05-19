'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, MessageSquare, GitCompare, Code2, Bot, Brain,
  ArrowRight, ChevronRight, Cpu, Globe, Sparkles, Check,
  Command, Keyboard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/bertos/cn'

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to BertOS',
    subtitle: 'Your AI command center',
    description: 'Control Claude, Codex, and Gemini from one unified workspace. Built for speed, power, and flow.',
    visual: (
      <div className="relative flex items-center justify-center w-full h-48">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-violet-500/10 border border-violet-500/20 animate-pulse" />
          <div className="absolute w-48 h-48 rounded-full bg-blue-500/5 border border-blue-500/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-[0_0_60px_rgba(139,92,246,0.5)]">
          <Zap className="w-8 h-8 text-white" />
        </div>
        {[
          { icon: <Cpu className="w-4 h-4" />, color: '#8B5CF6', x: -80, y: -30, label: 'Claude' },
          { icon: <Zap className="w-4 h-4" />, color: '#10B981', x: 80, y: -30, label: 'Codex' },
          { icon: <Globe className="w-4 h-4" />, color: '#3B82F6', x: 0, y: 70, label: 'Gemini' },
        ].map((node, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 200 }}
            className="absolute flex flex-col items-center gap-1"
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border"
              style={{ borderColor: `${node.color}40`, background: `${node.color}20`, color: node.color }}
            >
              {node.icon}
            </div>
            <span className="text-[10px] font-medium" style={{ color: node.color }}>{node.label}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 'router',
    title: 'Intelligent Routing',
    subtitle: 'Always the right model',
    description: 'BertOS analyzes each prompt and automatically routes to the best AI — Codex for code, Gemini for research, Claude for reasoning.',
    visual: (
      <div className="w-full space-y-2 px-4">
        {[
          { prompt: 'Fix this TypeScript error', model: 'Codex', color: '#10B981', confidence: 94, icon: <Zap className="w-3 h-3" /> },
          { prompt: 'Summarize this research paper', model: 'Gemini', color: '#3B82F6', confidence: 87, icon: <Globe className="w-3 h-3" /> },
          { prompt: 'Write a compelling pitch deck', model: 'Claude', color: '#8B5CF6', confidence: 91, icon: <Cpu className="w-3 h-3" /> },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5"
          >
            <span className="text-xs text-zinc-400 flex-1 truncate">"{item.prompt}"</span>
            <ArrowRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: item.color }}>
              {item.icon}
              <span className="text-xs font-semibold">{item.model}</span>
            </div>
            <span className="text-[10px] text-zinc-600">{item.confidence}%</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 'features',
    title: 'Everything in One Place',
    subtitle: 'The full AI toolkit',
    description: 'Compare all models side-by-side, run autonomous agents, manage project memory, and work in a full coding workspace.',
    visual: (
      <div className="grid grid-cols-2 gap-2 px-4 w-full">
        {[
          { icon: <GitCompare className="w-4 h-4" />, label: 'Multi-AI Compare', color: '#3B82F6' },
          { icon: <Bot className="w-4 h-4" />, label: 'Agent Tasks', color: '#10B981' },
          { icon: <Code2 className="w-4 h-4" />, label: 'Code Workspace', color: '#F59E0B' },
          { icon: <Brain className="w-4 h-4" />, label: 'Project Memory', color: '#8B5CF6' },
        ].map((feat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.1, type: 'spring' }}
            className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${feat.color}15`, color: feat.color, border: `1px solid ${feat.color}30` }}
            >
              {feat.icon}
            </div>
            <span className="text-xs font-medium text-zinc-300">{feat.label}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 'shortcuts',
    title: 'Built for Power Users',
    subtitle: 'Keyboard-first design',
    description: 'Every action is one keystroke away. BertOS is designed to keep your hands on the keyboard.',
    visual: (
      <div className="space-y-2 px-4 w-full">
        {[
          { keys: ['⌘', 'K'], label: 'Command palette' },
          { keys: ['⌘', 'Enter'], label: 'Send message' },
          { keys: ['/'], label: 'Slash commands' },
          { keys: ['Esc'], label: 'Cancel / close' },
        ].map((sc, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2"
          >
            <span className="text-xs text-zinc-400">{sc.label}</span>
            <div className="flex items-center gap-1">
              {sc.keys.map((key, j) => (
                <kbd
                  key={j}
                  className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-mono font-medium"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    ),
  },
]

interface OnboardingModalProps {
  onComplete: () => void
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-black"
      >
        {/* Top gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-blue-500 to-emerald-500" />

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 px-6 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                i === step ? 'bg-violet-500 flex-1' : i < step ? 'bg-violet-500/40 w-4' : 'bg-zinc-800 w-4'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="px-6 pt-5 pb-2"
          >
            <div className="mb-1">
              <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">
                {currentStep.subtitle}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-2 tracking-tight">
              {currentStep.title}
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed mb-6">
              {currentStep.description}
            </p>
            <div className="flex items-center justify-center min-h-[200px]">
              {currentStep.visual}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 pb-6 pt-4">
          <button
            onClick={onComplete}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Skip intro
          </button>
          <Button
            onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
            className="gap-2"
          >
            {isLast ? (
              <><Check className="w-4 h-4" />Launch BertOS</>
            ) : (
              <>Next<ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem('bertos-onboarded')
    if (!done) {
      const timer = setTimeout(() => setShowOnboarding(true), 600)
      return () => clearTimeout(timer)
    }
  }, [])

  const complete = () => {
    localStorage.setItem('bertos-onboarded', 'true')
    setShowOnboarding(false)
  }

  return { showOnboarding, complete }
}
