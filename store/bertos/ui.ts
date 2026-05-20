import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIModel, BertOSSettings } from '@/lib/bertos/types'

export type ActiveView = 'dashboard' | 'chat' | 'compare' | 'workspace' | 'agents' | 'memory' | 'settings'

interface UIStore {
  commandPaletteOpen: boolean
  rightPanelOpen: boolean
  rightPanelTab: 'logs' | 'memory' | 'tasks' | 'files' | 'terminal'
  sidebarCollapsed: boolean
  activeView: ActiveView
  selectedModel: AIModel
  settings: BertOSSettings
  /** Whether team mode orchestration is active */
  teamModeActive: boolean
  /** Workspace: last open file path */
  workspaceActiveFile: string | null
  /** Workspace: open tab paths */
  workspaceTabs: string[]

  setCommandPaletteOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  setRightPanelTab: (tab: UIStore['rightPanelTab']) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setActiveView: (view: ActiveView) => void
  setSelectedModel: (model: AIModel) => void
  updateSettings: (settings: Partial<BertOSSettings>) => void
  setTeamModeActive: (active: boolean) => void
  setWorkspaceActiveFile: (path: string | null) => void
  addWorkspaceTab: (path: string) => void
  removeWorkspaceTab: (path: string) => void
}

const DEFAULT_SETTINGS: BertOSSettings = {
  theme: 'dark',
  primaryModel: 'ollama-pro',
  routingEnabled: true,
  streamingEnabled: true,
  memoryEnabled: true,
  enableApiProviders: false,
  cliPaths: {},
  apiKeys: {},
  ollamaCloudModel: 'gpt-oss:120b-cloud',
  ollamaLocalFallback: 'qwen2.5-coder:latest',
  hermesUrl: '',
  hermesApiKey: '',
  modelPriority: ['ollama-pro', 'claude-code', 'gemini-cli', 'codex-cli', 'qwen2.5-coder'],
  tokenBudget: 100000,
  animationsEnabled: true,
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      commandPaletteOpen: false,
      rightPanelOpen: true,
      rightPanelTab: 'memory',
      sidebarCollapsed: false,
      activeView: 'dashboard',
      selectedModel: 'ollama-pro',
      settings: DEFAULT_SETTINGS,
      teamModeActive: false,
      workspaceActiveFile: null,
      workspaceTabs: [],

      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveView: (view) => set({ activeView: view }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      updateSettings: (settings) =>
        set(state => ({ settings: { ...state.settings, ...settings } })),
      setTeamModeActive: (active) => set({ teamModeActive: active }),
      setWorkspaceActiveFile: (path) => set({ workspaceActiveFile: path }),
      addWorkspaceTab: (path) =>
        set(state => ({
          workspaceTabs: state.workspaceTabs.includes(path)
            ? state.workspaceTabs
            : [...state.workspaceTabs.slice(-9), path],
        })),
      removeWorkspaceTab: (path) =>
        set(state => ({
          workspaceTabs: state.workspaceTabs.filter(t => t !== path),
          workspaceActiveFile:
            state.workspaceActiveFile === path
              ? state.workspaceTabs.find(t => t !== path) ?? null
              : state.workspaceActiveFile,
        })),
    }),
    {
      name: 'bertos-ui',
      partialize: (state) => ({
        rightPanelOpen: state.rightPanelOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        selectedModel: state.selectedModel,
        settings: state.settings,
        workspaceActiveFile: state.workspaceActiveFile,
        workspaceTabs: state.workspaceTabs,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UIStore>
        return {
          ...current,
          ...p,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(p.settings ?? {}),
            apiKeys:  { ...DEFAULT_SETTINGS.apiKeys,  ...(p.settings?.apiKeys  ?? {}) },
            cliPaths: { ...DEFAULT_SETTINGS.cliPaths, ...(p.settings?.cliPaths ?? {}) },
            modelPriority: p.settings?.modelPriority ?? DEFAULT_SETTINGS.modelPriority,
          },
        }
      },
    }
  )
)
