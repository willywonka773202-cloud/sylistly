'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Cpu, Zap, Globe, ArrowRight, ChevronDown, ChevronUp, Bot } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/bertos/cn'
import type { RouterDecision } from '@/lib/bertos/types'
import { getModelColor, getModelLabel } from '@/lib/bertos/router'

const MODEL_ICONS: Record<string, React.ReactNode> = {
  claude:          <Cpu     className="w-3 h-3" />,
  codex:           <Zap     className="w-3 h-3" />,
  gemini:          <Globe   className="w-3 h-3" />,
  auto:            <Sparkles className="w-3 h-3" />,
  llama3:          <Bot     className="w-3 h-3" />,
  'llama3.2':      <Bot     className="w-3 h-3" />,
  mistral:         <Bot     className="w-3 h-3" />,
  'deepseek-coder':<Bot     className="w-3 h-3" />,
  hermes3:         <Bot     className="w-3 h-3" />,
}

interface RouterBadgeProps {
  decision: RouterDecision
}

export function RouterBadge({ decision }: RouterBadgeProps) {
  const [open, setOpen] = useState(false)
  const primaryColor = getModelColor(decision.primary)

  return (
    <div className="my-2 flex justify-center">
      <div className="max-w-sm w-full">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:bg-zinc-950 transition-all group"
        >
          {/* Route visual */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            </div>
            <ArrowRight className="w-3 h-3 text-zinc-700 flex-shrink-0" />
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-md"
              style={{ background: `${primaryColor}15`, border: `1px solid ${primaryColor}30` }}
            >
              <span style={{ color: primaryColor }}>
                {MODEL_ICONS[decision.primary]}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: primaryColor }}>
                {getModelLabel(decision.primary)}
              </span>
            </div>
            {decision.secondary?.map(m => (
              <div
                key={m}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md opacity-60"
                style={{ background: `${getModelColor(m)}10`, border: `1px solid ${getModelColor(m)}20` }}
              >
                <span style={{ color: getModelColor(m) }}>{MODEL_ICONS[m]}</span>
                <span className="text-[10px]" style={{ color: getModelColor(m) }}>{getModelLabel(m)}</span>
              </div>
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-1">
              <div
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ background: `${primaryColor}15`, color: primaryColor }}
              >
                {Math.round(decision.confidence * 100)}%
              </div>
            </div>
          </div>
          <span className="text-zinc-700 group-hover:text-zinc-500 transition-colors">
            {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        </button>

        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-600">Task type</span>
                  <p className="text-zinc-300 font-medium capitalize">{decision.taskType}</p>
                </div>
                <div>
                  <span className="text-zinc-600">Strategy</span>
                  <p className="text-zinc-300 font-medium capitalize">{decision.strategy}</p>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed border-t border-zinc-800/50 pt-2">
                {decision.reasoning}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
