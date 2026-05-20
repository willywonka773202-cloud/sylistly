'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Plus, Play, Pause, CheckCircle2, XCircle,
  Clock, Activity, ChevronDown, ChevronUp, Cpu, Globe, Zap, Sparkles,
  Trash2, FlaskConical,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useAgentStore } from '@/store/bertos/agents'
import type { AgentTask, AIModel } from '@/lib/bertos/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EvolutionLab } from './EvolutionLab'

type AgentsTab = 'tasks' | 'evolution'
const TASK_TEMPLATES = [
  { title: 'Refactor Frontend',       description: 'Analyze and modernize all React components, extract reusable logic, improve TypeScript types', model: 'ollama-pro' as AIModel,  estimatedTime: '~8 min' },
  { title: 'Fix TypeScript Errors',   description: 'Scan codebase for type errors and fix them systematically',                                     model: 'ollama-pro' as AIModel,  estimatedTime: '~3 min' },
  { title: 'Generate Documentation',  description: 'Write comprehensive JSDoc comments for all exported functions',                                   model: 'claude-code' as AIModel, estimatedTime: '~5 min' },
  { title: 'Research Architecture',   description: 'Research best practices for the current tech stack and write recommendations',                     model: 'gemini-cli' as AIModel,  estimatedTime: '~4 min' },
  { title: 'Improve UI Components',   description: 'Review all UI components and suggest accessibility and UX improvements',                           model: 'claude-code' as AIModel, estimatedTime: '~6 min' },
  { title: 'Generate Test Suite',     description: 'Create comprehensive unit and integration tests for the entire codebase',                          model: 'codex-cli' as AIModel,   estimatedTime: '~10 min' },
]

const MODEL_META: Record<string, { icon: React.ReactNode; color: string; variant: 'ollama-pro' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'auto' | 'default' }> = {
  'ollama-pro':   { icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', variant: 'ollama-pro'  },
  'qwen2.5-coder':{ icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', variant: 'ollama-pro'  },
  'claude-code':  { icon: <Cpu      className="w-3.5 h-3.5" />, color: '#8B5CF6', variant: 'claude-code' },
  'gemini-cli':   { icon: <Globe    className="w-3.5 h-3.5" />, color: '#3B82F6', variant: 'gemini-cli'  },
  'codex-cli':    { icon: <Zap      className="w-3.5 h-3.5" />, color: '#10B981', variant: 'codex-cli'   },
  auto:           { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#F59E0B', variant: 'auto'        },
}

const STATUS_CONFIG: Record<AgentTask['status'], { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-zinc-400', bgColor: 'bg-zinc-400', label: 'Pending' },
  running: { icon: <Activity className="w-3.5 h-3.5 animate-pulse" />, color: 'text-violet-400', bgColor: 'bg-violet-400', label: 'Running' },
  paused: { icon: <Pause className="w-3.5 h-3.5" />, color: 'text-amber-400', bgColor: 'bg-amber-400', label: 'Paused' },
  done: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-emerald-400', bgColor: 'bg-emerald-400', label: 'Complete' },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-400', bgColor: 'bg-red-400', label: 'Failed' },
}

function TaskCard({ task }: { task: AgentTask }) {
  const { deleteTask, setStatus, addLog, setProgress } = useAgentStore()
  const [expanded, setExpanded] = useState(false)
  const meta = MODEL_META[task.model] ?? MODEL_META['ollama-pro']
  const status = STATUS_CONFIG[task.status]

  const simulate = async () => {
    setStatus(task.id, 'running')
    const steps = [
      { msg: 'Initializing agent context...', progress: 10 },
      { msg: 'Scanning codebase...', progress: 25 },
      { msg: 'Analyzing patterns...', progress: 40 },
      { msg: 'Generating improvements...', progress: 60 },
      { msg: 'Validating changes...', progress: 80 },
      { msg: 'Finalizing output...', progress: 95 },
    ]
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400))
      addLog(task.id, { level: 'info', message: step.msg })
      setProgress(task.id, step.progress)
    }
    await new Promise(r => setTimeout(r, 600))
    setStatus(task.id, 'done')
    setProgress(task.id, 100)
    addLog(task.id, { level: 'success', message: 'Task completed successfully.' })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all duration-300',
        task.status === 'running' && 'border-violet-500/30 bg-violet-500/5',
        task.status === 'done' && 'border-emerald-500/20 bg-emerald-500/5',
        task.status === 'failed' && 'border-red-500/20 bg-red-500/5',
        task.status === 'pending' || task.status === 'paused' ? 'border-zinc-800 bg-zinc-900/50' : ''
      )}
    >
      <div className="flex items-start gap-3">
        {/* Model icon */}
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border"
          style={{ borderColor: `${meta.color}30`, background: `${meta.color}15` }}
        >
          <span style={{ color: meta.color }}>{meta.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-zinc-200">{task.title}</h3>
            <Badge variant={meta.variant} className="text-[9px] h-4 px-1.5">
              {task.model}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 line-clamp-2">{task.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-xs flex items-center gap-1', status.color)}>
            {status.icon}
            {status.label}
          </span>
          {task.status === 'pending' && (
            <Button size="sm" onClick={simulate}>
              <Play className="w-3 h-3" />
              Run
            </Button>
          )}
          {task.status === 'done' && (
            <Button size="icon-sm" variant="ghost" onClick={() => deleteTask(task.id)} className="text-zinc-600">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(task.status === 'running' || task.status === 'done') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <Progress value={task.progress} />
        </div>
      )}

      {/* Logs toggle */}
      {task.logs.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {task.logs.length} log entries
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2"
              >
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
                  {task.logs.map(log => (
                    <div key={log.id} className={cn(
                      'flex items-start gap-2',
                      log.level === 'error' && 'text-red-400',
                      log.level === 'warn' && 'text-amber-400',
                      log.level === 'success' && 'text-emerald-400',
                      log.level === 'info' && 'text-zinc-500',
                    )}>
                      <span className="text-zinc-700 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

export function AgentsView() {
  const { tasks, createTask } = useAgentStore()
  const [activeTab, setActiveTab] = useState<AgentsTab>('tasks')
  const [showTemplates, setShowTemplates] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customModel, setCustomModel] = useState<AIModel>('auto')

  const addFromTemplate = (template: typeof TASK_TEMPLATES[number]) => {
    createTask({ title: template.title, description: template.description, model: template.model })
    setShowTemplates(false)
  }

  const addCustom = () => {
    if (!customTitle.trim()) return
    createTask({ title: customTitle.trim(), description: customDesc.trim() || 'Custom agent task', model: customModel })
    setCustomTitle('')
    setCustomDesc('')
  }

  const running = tasks.filter(t => t.status === 'running').length
  const done = tasks.filter(t => t.status === 'done').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab strip */}
      <div className="flex-shrink-0 flex items-center gap-0.5 px-4 pt-3 pb-0 border-b border-zinc-800/50 bg-zinc-950/30">
        <button
          onClick={() => setActiveTab('tasks')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-t-md text-xs font-medium border-b-2 -mb-px transition-all',
            activeTab === 'tasks'
              ? 'border-violet-500 text-zinc-100 bg-zinc-800/50'
              : 'border-transparent text-zinc-600 hover:text-zinc-400',
          )}
        >
          <Bot className="w-3.5 h-3.5" />
          Agent Tasks
        </button>
        <button
          onClick={() => setActiveTab('evolution')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-t-md text-xs font-medium border-b-2 -mb-px transition-all',
            activeTab === 'evolution'
              ? 'border-violet-500 text-zinc-100 bg-zinc-800/50'
              : 'border-transparent text-zinc-600 hover:text-zinc-400',
          )}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Evolution Lab
        </button>
      </div>

      {/* Evolution Lab */}
      {activeTab === 'evolution' && (
        <div className="flex-1 overflow-hidden">
          <EvolutionLab />
        </div>
      )}

      {/* Agent Tasks */}
      {activeTab === 'tasks' && <>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Agent Tasks</h2>
                <p className="text-[11px] text-zinc-500">Long-running autonomous AI operations</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {running > 0 && (
                <div className="flex items-center gap-1.5 text-violet-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  {running} running
                </div>
              )}
              {done > 0 && (
                <span className="text-emerald-400">{done} done</span>
              )}
              <span className="text-zinc-600">{tasks.length} total</span>
            </div>
          </div>

          {/* Create task */}
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
              <input
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="Task title: e.g. Refactor the authentication module"
                className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
              />
              <input
                value={customDesc}
                onChange={e => setCustomDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-transparent text-xs text-zinc-400 placeholder:text-zinc-700 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <select
                value={customModel}
                onChange={e => setCustomModel(e.target.value as AIModel)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 outline-none"
              >
                <option value="auto">Auto</option>
                <option value="claude">Claude</option>
                <option value="codex">Codex</option>
                <option value="gemini">Gemini</option>
              </select>
              <Button onClick={addCustom} disabled={!customTitle.trim()} size="sm">
                <Plus className="w-3.5 h-3.5" /> Add Task
              </Button>
            </div>
          </div>

          {/* Templates */}
          <div className="mt-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
            >
              {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Browse task templates
            </button>
            <AnimatePresence>
              {showTemplates && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {TASK_TEMPLATES.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => addFromTemplate(t)}
                        className="text-left rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 p-3 transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-zinc-300">{t.title}</p>
                          <Badge variant={(MODEL_META[t.model]?.variant ?? 'default') as 'ollama-pro' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'auto' | 'default'} className="text-[9px] h-4">{t.model}</Badge>
                        </div>
                        <p className="text-[11px] text-zinc-600 line-clamp-2">{t.description}</p>
                        <p className="text-[10px] text-zinc-700 mt-1">{t.estimatedTime}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tasks list */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="w-12 h-12 text-zinc-800 mb-4" />
              <p className="text-zinc-600 text-sm">No agent tasks yet</p>
              <p className="text-zinc-700 text-xs mt-1">Create a task above or pick a template to get started</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
      </>}
    </div>
  )
}
