'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Terminal, Brain, ListTodo, FolderOpen, Activity, CheckCircle2, Circle, Plus, Cpu, Globe, Zap } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useProjectStore } from '@/store/bertos/projects'
import { useAgentStore } from '@/store/bertos/agents'
import { useChatStore } from '@/store/bertos/chat'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useState } from 'react'

export function RightPanel() {
  const { rightPanelOpen, rightPanelTab, setRightPanelOpen, setRightPanelTab } = useUIStore()
  const { getActiveProject, toggleTodo, addTodo, projects } = useProjectStore()
  const { tasks } = useAgentStore()
  const { sessions } = useChatStore()
  const [newTodo, setNewTodo] = useState('')

  const project = getActiveProject()

  if (!rightPanelOpen) return null

  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending')

  return (
    <motion.aside
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      className="w-64 flex flex-col h-full bg-[#0D0D0F] border-l border-zinc-800/50 flex-shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800/50">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Panel</span>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)} className="flex flex-col flex-1 min-h-0">
        <div className="px-2 pt-2">
          <TabsList className="w-full grid grid-cols-3 h-auto p-0.5">
            <TabsTrigger value="memory" className="text-[10px] py-1">
              <Brain className="w-3 h-3 mr-1" />Memory
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-[10px] py-1">
              <Activity className="w-3 h-3 mr-1" />Tasks
              {activeTasks.length > 0 && (
                <span className="ml-1 bg-violet-500 text-white text-[9px] rounded-full px-1 min-w-4 text-center">
                  {activeTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="files" className="text-[10px] py-1">
              <FolderOpen className="w-3 h-3 mr-1" />Files
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* Memory tab */}
          <TabsContent value="memory" className="px-3 py-2 space-y-4 m-0">
            {/* Project context */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full bg-violet-400" />
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Project Context
                </span>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {project?.context || 'No context set for this project. Add context to give AI systems better understanding of your work.'}
                </p>
              </div>
            </div>

            {/* AI Status */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  AI Systems
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'Claude', icon: <Cpu className="w-3 h-3" />, status: 'active', color: '#8B5CF6' },
                  { name: 'Codex', icon: <Zap className="w-3 h-3" />, status: 'standby', color: '#10B981' },
                  { name: 'Gemini', icon: <Globe className="w-3 h-3" />, status: 'standby', color: '#3B82F6' },
                ].map(ai => (
                  <div key={ai.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                    <span style={{ color: ai.color }}>{ai.icon}</span>
                    <span className="text-xs text-zinc-400 flex-1">{ai.name}</span>
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      ai.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                    )} />
                    <span className="text-[10px] text-zinc-600">{ai.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Todos */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ListTodo className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Todos
                </span>
              </div>
              <div className="space-y-1">
                {project?.todos.map(todo => (
                  <button
                    key={todo.id}
                    onClick={() => project && toggleTodo(project.id, todo.id)}
                    className="w-full flex items-start gap-2 text-left group"
                  >
                    {todo.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5 group-hover:text-zinc-400 transition-colors" />
                    )}
                    <span className={cn(
                      'text-xs leading-relaxed transition-colors',
                      todo.done ? 'text-zinc-600 line-through' : 'text-zinc-400 group-hover:text-zinc-300'
                    )}>
                      {todo.text}
                    </span>
                  </button>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (newTodo.trim() && project) {
                      addTodo(project.id, newTodo.trim())
                      setNewTodo('')
                    }
                  }}
                  className="flex items-center gap-1.5 mt-2"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                  <input
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    placeholder="Add todo..."
                    className="flex-1 bg-transparent text-xs text-zinc-400 placeholder:text-zinc-700 outline-none"
                  />
                </form>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Session Stats</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Chats', value: sessions.length },
                  { label: 'Projects', value: projects.length },
                  { label: 'Tasks', value: tasks.length },
                  { label: 'Messages', value: sessions.reduce((acc, s) => acc + s.messages.length, 0) },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <p className="text-lg font-bold text-zinc-200">{stat.value}</p>
                    <p className="text-[10px] text-zinc-600">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Tasks tab */}
          <TabsContent value="tasks" className="px-3 py-2 space-y-2 m-0">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-600">No active tasks</p>
                <p className="text-[10px] text-zinc-700 mt-1">Create agent tasks to automate work</p>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                      task.status === 'running' ? 'bg-violet-400 animate-pulse' :
                      task.status === 'done' ? 'bg-emerald-400' :
                      task.status === 'failed' ? 'bg-red-400' : 'bg-zinc-600'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-300 truncate">{task.title}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{task.description}</p>
                    </div>
                  </div>
                  {task.status === 'running' && (
                    <Progress value={task.progress} className="h-1" />
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant={task.status === 'done' ? 'success' : task.status === 'failed' ? 'error' : task.status === 'running' ? 'info' : 'default'} className="text-[9px] h-4">
                      {task.status}
                    </Badge>
                    <span className="text-[10px] text-zinc-700">{task.model}</span>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Files tab */}
          <TabsContent value="files" className="px-3 py-2 m-0">
            {!project?.files.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FolderOpen className="w-8 h-8 text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-600">No files uploaded</p>
                <p className="text-[10px] text-zinc-700 mt-1">Drag files into chat to upload</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {project.files.map(file => (
                  <div key={file.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-2">
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-300 truncate">{file.name}</p>
                      <p className="text-[10px] text-zinc-600">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </motion.aside>
  )
}
