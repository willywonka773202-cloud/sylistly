import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Project, Todo, ProjectFile } from '@/lib/bertos/types'

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'default',
    name: 'General',
    description: 'Default workspace',
    color: '#8B5CF6',
    icon: '🤖',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sessions: [],
    files: [],
    todos: [],
    pinned: true,
    context: '',
  },
]

interface ProjectStore {
  projects: Project[]
  activeProjectId: string

  createProject: (data: Partial<Project>) => Project
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  setActiveProject: (id: string) => void
  getActiveProject: () => Project | null

  addTodo: (projectId: string, text: string) => void
  toggleTodo: (projectId: string, todoId: string) => void
  deleteTodo: (projectId: string, todoId: string) => void

  addFile: (projectId: string, file: Omit<ProjectFile, 'id' | 'uploadedAt'>) => void
  removeFile: (projectId: string, fileId: string) => void

  updateContext: (projectId: string, context: string) => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: DEFAULT_PROJECTS,
      activeProjectId: 'default',

      createProject: (data) => {
        const project: Project = {
          id: uuidv4(),
          name: data.name ?? 'New Project',
          description: data.description ?? '',
          color: data.color ?? '#8B5CF6',
          icon: data.icon ?? '📁',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sessions: [],
          files: [],
          todos: [],
          pinned: false,
          context: '',
        }
        set(state => ({ projects: [...state.projects, project] }))
        return project
      },

      updateProject: (id, updates) =>
        set(state => ({
          projects: state.projects.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        })),

      deleteProject: (id) =>
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          activeProjectId:
            state.activeProjectId === id ? 'default' : state.activeProjectId,
        })),

      setActiveProject: (id) => set({ activeProjectId: id }),

      getActiveProject: () => {
        const { projects, activeProjectId } = get()
        return projects.find(p => p.id === activeProjectId) ?? null
      },

      addTodo: (projectId, text) => {
        const todo: Todo = {
          id: uuidv4(),
          text,
          done: false,
          createdAt: Date.now(),
        }
        set(state => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? { ...p, todos: [...p.todos, todo], updatedAt: Date.now() }
              : p
          ),
        }))
      },

      toggleTodo: (projectId, todoId) =>
        set(state => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  todos: p.todos.map(t =>
                    t.id === todoId ? { ...t, done: !t.done } : t
                  ),
                }
              : p
          ),
        })),

      deleteTodo: (projectId, todoId) =>
        set(state => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? { ...p, todos: p.todos.filter(t => t.id !== todoId) }
              : p
          ),
        })),

      addFile: (projectId, fileData) => {
        const file: ProjectFile = {
          ...fileData,
          id: uuidv4(),
          uploadedAt: Date.now(),
        }
        set(state => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? { ...p, files: [...p.files, file] }
              : p
          ),
        }))
      },

      removeFile: (projectId, fileId) =>
        set(state => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? { ...p, files: p.files.filter(f => f.id !== fileId) }
              : p
          ),
        })),

      updateContext: (projectId, context) =>
        set(state => ({
          projects: state.projects.map(p =>
            p.id === projectId ? { ...p, context, updatedAt: Date.now() } : p
          ),
        })),
    }),
    { name: 'bertos-projects' }
  )
)
