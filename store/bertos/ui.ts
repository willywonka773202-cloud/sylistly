import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIModel, BertOSSettings } from '@/lib/bertos/types'

interface UIStore {
  commandPaletteOpen: boolean
  rightPanelOpen: boolean
  rightPanelTab: 'logs' | 'memory' | 'tasks' | 'files' | 'terminal'
  sidebarCollapsed: boolean
  activeView: 'chat' | 'compare' | 'workspace' | 'agents' | 'memory' | 'settings'
  selectedModel: AIModel
  settings: BertOSSettings

  setCommandPaletteOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  setRightPanelTab: (tab: UIStore['rightPanelTab']) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setActiveView: (view: UIStore['activeView']) => void
  setSelectedModel: (model: AIModel) => void
  updateSettings: (settings: Partial<BertOSSettings>) => void
}

const DEFAULT_SETTINGS: BertOSSettings = {
  theme: 'dark',
  primaryModel: 'auto',
  routingEnabled: true,
  streamingEnabled: true,
  memoryEnabled: true,
  cliPaths: {},
  apiKeys: {},
  modelPriority: ['claude', 'codex', 'gemini'],
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
      activeView: 'chat',
      selectedModel: 'auto',
      settings: DEFAULT_SETTINGS,

      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveView: (view) => set({ activeView: view }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      updateSettings: (settings) =>
        set(state => ({ settings: { ...state.settings, ...settings } })),
    }),
    {
      name: 'bertos-ui',
      partialize: (state) => ({
        rightPanelOpen: state.rightPanelOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        selectedModel: state.selectedModel,
        settings: state.settings,
      }),
    }
  )
)
