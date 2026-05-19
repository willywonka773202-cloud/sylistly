'use client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, GitCompare, Code2, Bot, Brain, Settings,
  Plus, ChevronLeft, ChevronRight, Folder, Star, Hash,
  Zap, Command
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useProjectStore } from '@/store/bertos/projects'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { id: 'chat', icon: MessageSquare, label: 'Chat', href: '/chat' },
  { id: 'compare', icon: GitCompare, label: 'Compare', href: '/compare' },
  { id: 'workspace', icon: Code2, label: 'Workspace', href: '/workspace' },
  { id: 'agents', icon: Bot, label: 'Agents', href: '/agents' },
  { id: 'memory', icon: Brain, label: 'Memory', href: '/memory' },
] as const

const PROJECT_ICONS: Record<string, string> = {
  default: '🤖',
}

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, activeView, setActiveView, setCommandPaletteOpen } = useUIStore()
  const { sessions, activeSessionId, setActiveSession, createSession } = useChatStore()
  const { projects, activeProjectId, setActiveProject } = useProjectStore()
  const router = useRouter()

  const recentSessions = sessions.slice(0, 8)

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex h-full flex-col bg-[#0D0D0F] border-r border-zinc-800/50 overflow-hidden z-10"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-zinc-800/50">
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)]">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0D0D0F]" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="min-w-0"
            >
              <p className="text-sm font-bold text-zinc-100 tracking-tight">BertOS</p>
              <p className="text-[10px] text-zinc-500 leading-none">AI Operating System</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-3 space-y-1">
          {/* Command palette shortcut */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-150 group',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                <Command className="w-3.5 h-3.5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="flex-1 text-left">Command palette</span>
                )}
                {!sidebarCollapsed && (
                  <kbd className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-700">⌘K</kbd>
                )}
              </button>
            </TooltipTrigger>
            {sidebarCollapsed && <TooltipContent side="right">Command Palette (⌘K)</TooltipContent>}
          </Tooltip>

          {/* New chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  createSession()
                  setActiveView('chat')
                  router.push('/chat')
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all duration-150 border border-dashed border-zinc-800 hover:border-zinc-600',
                  sidebarCollapsed && 'justify-center'
                )}
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                {!sidebarCollapsed && <span>New Chat</span>}
              </button>
            </TooltipTrigger>
            {sidebarCollapsed && <TooltipContent side="right">New Chat</TooltipContent>}
          </Tooltip>

          {/* Nav items */}
          <div className="pt-2 space-y-0.5">
            {!sidebarCollapsed && (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                Navigation
              </p>
            )}
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setActiveView(item.id)
                        router.push(item.href)
                      }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150',
                        isActive
                          ? 'bg-violet-500/15 text-violet-300 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)]'
                          : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5',
                        sidebarCollapsed && 'justify-center'
                      )}
                    >
                      <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-violet-400')} />
                      {!sidebarCollapsed && (
                        <span className="text-xs font-medium">{item.label}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                </Tooltip>
              )
            })}
          </div>

          {/* Projects */}
          {!sidebarCollapsed && (
            <div className="pt-3">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                Projects
              </p>
              <div className="space-y-0.5">
                {projects.slice(0, 5).map(project => (
                  <button
                    key={project.id}
                    onClick={() => setActiveProject(project.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-150',
                      activeProjectId === project.id
                        ? 'bg-white/5 text-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    )}
                  >
                    <span className="text-sm leading-none">{project.icon}</span>
                    <span className="flex-1 text-left truncate font-medium">{project.name}</span>
                    {activeProjectId === project.id && (
                      <div className="w-1 h-1 rounded-full bg-violet-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent chats */}
          {!sidebarCollapsed && recentSessions.length > 0 && (
            <div className="pt-3">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                Recent
              </p>
              <div className="space-y-0.5">
                {recentSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setActiveSession(session.id)
                      setActiveView('chat')
                      router.push('/chat')
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-150',
                      activeSessionId === session.id
                        ? 'bg-white/5 text-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                    )}
                  >
                    <Hash className="w-3 h-3 flex-shrink-0 opacity-50" />
                    <span className="flex-1 text-left truncate">{session.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom actions */}
      <div className="border-t border-zinc-800/50 p-2 space-y-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                setActiveView('settings')
                router.push('/settings')
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all duration-150',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </TooltipTrigger>
          {sidebarCollapsed && <TooltipContent side="right">Settings</TooltipContent>}
        </Tooltip>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all duration-150',
            sidebarCollapsed ? 'justify-center' : 'justify-end'
          )}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          {!sidebarCollapsed && <span className="text-[10px]">Collapse</span>}
        </button>
      </div>
    </motion.aside>
  )
}
