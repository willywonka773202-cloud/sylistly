import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { AgentTask, AgentLog, AgentCheckpoint, AIModel } from '@/lib/bertos/types'

interface AgentStore {
  tasks: AgentTask[]
  activeTaskId: string | null

  createTask: (data: { title: string; description: string; model?: AIModel; projectId?: string }) => AgentTask
  updateTask: (id: string, updates: Partial<AgentTask>) => void
  deleteTask: (id: string) => void
  setActiveTask: (id: string | null) => void

  addLog: (taskId: string, log: Omit<AgentLog, 'id' | 'timestamp'>) => void
  addCheckpoint: (taskId: string, checkpoint: Omit<AgentCheckpoint, 'id' | 'timestamp'>) => void
  setProgress: (taskId: string, progress: number) => void
  setStatus: (taskId: string, status: AgentTask['status']) => void
}

export const useAgentStore = create<AgentStore>()(
  persist(
    (set) => ({
      tasks: [],
      activeTaskId: null,

      createTask: ({ title, description, model = 'ollama-pro', projectId }) => {
        const task: AgentTask = {
          id: uuidv4(),
          title,
          description,
          status: 'pending',
          model,
          progress: 0,
          logs: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectId,
          checkpoints: [],
        }
        set(state => ({ tasks: [task, ...state.tasks], activeTaskId: task.id }))
        return task
      },

      updateTask: (id, updates) =>
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        })),

      deleteTask: (id) =>
        set(state => ({
          tasks: state.tasks.filter(t => t.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
        })),

      setActiveTask: (id) => set({ activeTaskId: id }),

      addLog: (taskId, logData) => {
        const log: AgentLog = { ...logData, id: uuidv4(), timestamp: Date.now() }
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === taskId
              ? { ...t, logs: [...t.logs, log], updatedAt: Date.now() }
              : t
          ),
        }))
      },

      addCheckpoint: (taskId, data) => {
        const checkpoint: AgentCheckpoint = { ...data, id: uuidv4(), timestamp: Date.now() }
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === taskId
              ? { ...t, checkpoints: [...t.checkpoints, checkpoint] }
              : t
          ),
        }))
      },

      setProgress: (taskId, progress) =>
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, progress, updatedAt: Date.now() } : t
          ),
        })),

      setStatus: (taskId, status) =>
        set(state => ({
          tasks: state.tasks.map(t =>
            t.id === taskId ? { ...t, status, updatedAt: Date.now() } : t
          ),
        })),
    }),
    { name: 'bertos-agents' }
  )
)
