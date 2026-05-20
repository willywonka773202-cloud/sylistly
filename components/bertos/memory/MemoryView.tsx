'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Plus, Folder, Edit3, Trash2, Check, X, Pin,
  MessageSquare, FileText, Clock, Tag, Search
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useProjectStore } from '@/store/bertos/projects'
import { useChatStore } from '@/store/bertos/chat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const PROJECT_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]
const PROJECT_ICONS = ['🤖', '🚀', '⚡', '🔥', '💡', '🎯', '🌊', '🎨', '🔬', '💎']

export function MemoryView() {
  const { projects, activeProjectId, createProject, updateProject, deleteProject, setActiveProject, updateContext } = useProjectStore()
  const { sessions } = useChatStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCtx, setEditCtx] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [newIcon, setNewIcon] = useState(PROJECT_ICONS[0])
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const startEdit = (p: typeof projects[number]) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditCtx(p.context)
  }

  const saveEdit = (id: string) => {
    updateProject(id, { name: editName, context: editCtx })
    setEditingId(null)
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    createProject({ name: newName.trim(), description: newDesc.trim(), color: newColor, icon: newIcon })
    setNewName('')
    setNewDesc('')
    setShowCreate(false)
  }

  const getSessionCount = (projectId: string) =>
    sessions.filter(s => s.projectId === projectId).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Project Memory</h2>
                <p className="text-[11px] text-zinc-500">Persistent context and knowledge for each project</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="w-3.5 h-3.5" />
              New Project
            </Button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <Search className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-700 outline-none"
            />
          </div>

          {/* Create form */}
          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3"
              >
                <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
                  <p className="text-xs font-semibold text-zinc-400">Create New Project</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Project name"
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none col-span-2"
                    />
                    <input
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 placeholder:text-zinc-700 outline-none col-span-2"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-1.5">Color</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {PROJECT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewColor(c)}
                            className={cn('w-5 h-5 rounded-full transition-all', newColor === c && 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900 scale-110')}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-1.5">Icon</p>
                      <div className="flex gap-1 flex-wrap">
                        {PROJECT_ICONS.map(icon => (
                          <button
                            key={icon}
                            onClick={() => setNewIcon(icon)}
                            className={cn('w-6 h-6 text-sm rounded flex items-center justify-center transition-all', newIcon === icon && 'bg-zinc-700')}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={!newName.trim()} size="sm">
                      <Check className="w-3.5 h-3.5" /> Create Project
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Projects grid */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence initial={false}>
              {filtered.map(project => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    'relative rounded-xl border p-4 space-y-3 cursor-pointer transition-all duration-200 group',
                    activeProjectId === project.id
                      ? 'border-zinc-600 bg-zinc-800/50'
                      : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60'
                  )}
                  onClick={() => setActiveProject(project.id)}
                >
                  {/* Active indicator */}
                  {activeProjectId === project.id && (
                    <div className="absolute top-3 right-3">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: project.color }} />
                    </div>
                  )}

                  {/* Project header */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${project.color}20`, border: `1px solid ${project.color}30` }}
                    >
                      {project.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === project.id ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm text-zinc-200 outline-none mb-1"
                          autoFocus
                        />
                      ) : (
                        <h3 className="text-sm font-semibold text-zinc-200 truncate">{project.name}</h3>
                      )}
                      <p className="text-xs text-zinc-500 truncate">{project.description || 'No description'}</p>
                    </div>
                  </div>

                  {/* Context editor */}
                  {editingId === project.id ? (
                    <div onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] text-zinc-600 mb-1">AI Context</p>
                      <textarea
                        value={editCtx}
                        onChange={e => setEditCtx(e.target.value)}
                        placeholder="Describe this project so AI understands it better..."
                        rows={3}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => saveEdit(project.id)}>
                          <Check className="w-3 h-3" /> Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    project.context && (
                      <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/50 p-2.5">
                        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3">{project.context}</p>
                      </div>
                    )
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {getSessionCount(project.id)} chats
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {project.files.length} files
                    </div>
                    <div className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {project.todos.filter(t => !t.done).length} todos
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(project) }}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1 rounded hover:bg-white/5"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    {project.id !== 'default' && (
                      <button
                        onClick={e => { e.stopPropagation(); deleteProject(project.id) }}
                        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
