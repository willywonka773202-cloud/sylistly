'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, Sparkles, Cpu, Globe, Zap,
  StopCircle, Image, FileText, X, Bot
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { getModelColor } from '@/lib/bertos/router'
import type { AIModel } from '@/lib/bertos/types'

interface InputBarProps {
  onSubmit: (content: string, attachments?: File[]) => void
  onStop?: () => void
  isStreaming: boolean
  disabled?: boolean
}

const MODEL_HINTS: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  auto:            { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#F59E0B', label: 'Auto'           },
  claude:          { icon: <Cpu     className="w-3.5 h-3.5" />, color: '#8B5CF6', label: 'Claude'          },
  codex:           { icon: <Zap     className="w-3.5 h-3.5" />, color: '#10B981', label: 'Codex'           },
  gemini:          { icon: <Globe   className="w-3.5 h-3.5" />, color: '#3B82F6', label: 'Gemini'          },
  'llama3.2':      { icon: <Bot     className="w-3.5 h-3.5" />, color: '#F97316', label: 'Llama 3.2'       },
  mistral:         { icon: <Bot     className="w-3.5 h-3.5" />, color: '#EC4899', label: 'Mistral'         },
  'deepseek-coder':{ icon: <Bot     className="w-3.5 h-3.5" />, color: '#06B6D4', label: 'DeepSeek Coder'  },
}

const SLASH_COMMANDS = [
  { cmd: '/compare', desc: 'Compare across all models' },
  { cmd: '/ask-all', desc: 'Ask all AI systems simultaneously' },
  { cmd: '/code', desc: 'Route to coding model' },
  { cmd: '/research', desc: 'Route to research model' },
  { cmd: '/explain', desc: 'Get a detailed explanation' },
  { cmd: '/summarize', desc: 'Summarize the conversation' },
]

export function InputBar({ onSubmit, onStop, isStreaming, disabled }: InputBarProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [showSlash, setShowSlash] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { selectedModel } = useUIStore()

  const model = MODEL_HINTS[selectedModel] ?? MODEL_HINTS.auto

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setValue(v)
    if (v.startsWith('/')) {
      setShowSlash(true)
      setSlashQuery(v.slice(1).toLowerCase())
    } else {
      setShowSlash(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') setShowSlash(false)
  }

  const handleSubmit = () => {
    if (!value.trim() || isStreaming) return
    onSubmit(value.trim(), attachments.length ? attachments : undefined)
    setValue('')
    setAttachments([])
    setShowSlash(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setAttachments(prev => [...prev, ...files])
  }

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.cmd.includes(slashQuery) || c.desc.toLowerCase().includes(slashQuery)
  )

  return (
    <div className="relative px-4 pb-4 pt-2">
      {/* Slash command menu */}
      <AnimatePresence>
        {showSlash && filteredCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-full left-4 right-4 mb-2 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
          >
            {filteredCommands.map(cmd => (
              <button
                key={cmd.cmd}
                onClick={() => { setValue(cmd.cmd + ' '); setShowSlash(false); textareaRef.current?.focus() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
              >
                <span className="text-xs font-mono text-violet-400 font-semibold">{cmd.cmd}</span>
                <span className="text-xs text-zinc-500">{cmd.desc}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 flex-wrap mb-2"
          >
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400">
                {file.type.startsWith('image/') ? (
                  <Image className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-violet-400" />
                )}
                <span className="max-w-24 truncate">{file.name}</span>
                <button onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}>
                  <X className="w-3 h-3 hover:text-zinc-200 transition-colors" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input container */}
      <div className={cn(
        'relative flex items-end gap-2 rounded-2xl border bg-zinc-900/80 backdrop-blur-sm transition-all duration-200',
        'border-zinc-800 focus-within:border-zinc-700 focus-within:shadow-[0_0_0_1px_rgba(139,92,246,0.2)]'
      )}>
        {/* File attach */}
        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.py" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 ml-3 mb-3 p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${model.label}... (/ for commands, Shift+Enter for newline)`}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none min-h-[44px] max-h-[200px] overflow-y-auto scrollbar-hide"
        />

        {/* Model indicator */}
        <div className="flex-shrink-0 mb-3 mr-1 flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all"
            style={{
              borderColor: `${model.color}30`,
              background: `${model.color}10`,
              color: model.color,
            }}
          >
            {model.icon}
            <span className="hidden sm:block">{model.label}</span>
          </div>

          {/* Send/Stop */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center text-red-400 hover:bg-red-600/30 transition-all"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!value.trim()}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150',
                value.trim()
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-zinc-700 mt-2">
        BertOS can make mistakes. Verify important information.
      </p>
    </div>
  )
}
