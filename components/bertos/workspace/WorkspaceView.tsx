'use client'

import { useState, useCallback } from 'react'
import { Code2, GitBranch, Users, Zap, Terminal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { FileExplorer } from './FileExplorer'
import { CodeEditor } from './CodeEditor'
import { PatchWorkflow } from './PatchWorkflow'
import { GitPanel } from './GitPanel'
import { TeamMode } from './TeamMode'
import { TerminalPanel } from './TerminalPanel'

type WorkspaceTab = 'editor' | 'patch' | 'git' | 'team' | 'terminal'

const TABS: { id: WorkspaceTab; icon: typeof Code2; label: string }[] = [
  { id: 'editor',   icon: Code2,      label: 'Editor'    },
  { id: 'patch',    icon: Zap,        label: 'AI Patch'  },
  { id: 'git',      icon: GitBranch,  label: 'Git'       },
  { id: 'team',     icon: Users,      label: 'Team Mode' },
  { id: 'terminal', icon: Terminal,   label: 'Terminal'  },
]

const DAEMON = 'http://localhost:3001'

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', md: 'markdown', json: 'json', css: 'css', scss: 'scss',
    html: 'html', sh: 'shellscript', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    rs: 'rust', go: 'go', mjs: 'javascript', mts: 'typescript',
  }
  return map[ext] ?? 'plaintext'
}

export function WorkspaceView() {
  const { teamModeActive } = useUIStore()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(teamModeActive ? 'team' : 'editor')
  const [explorerOpen, setExplorerOpen] = useState(true)

  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent]   = useState('')
  const [unsaved, setUnsaved]           = useState(false)
  const [loadingFile, setLoadingFile]   = useState(false)

  const handleFileSelect = useCallback(async (path: string) => {
    if (path === selectedFile) return
    setLoadingFile(true)
    try {
      const res = await fetch(`${DAEMON}/repo/file?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error('Failed to load file')
      const data = await res.json() as { content?: string }
      setSelectedFile(path)
      setFileContent(data.content ?? '')
      setUnsaved(false)
      setActiveTab('editor')
    } catch {
      // daemon offline or file unreadable — open with empty content
      setSelectedFile(path)
      setFileContent('')
      setUnsaved(false)
    } finally {
      setLoadingFile(false)
    }
  }, [selectedFile])

  const handleContentChange = useCallback((value: string) => {
    setFileContent(value)
    setUnsaved(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedFile) return
    try {
      await fetch(`${DAEMON}/repo/file/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content: fileContent }),
      })
      setUnsaved(false)
    } catch {
      // daemon offline — silent fail, user sees no indicator change
    }
  }, [selectedFile, fileContent])

  const language = selectedFile ? detectLanguage(selectedFile) : 'plaintext'

  return (
    <div className="flex h-full overflow-hidden bg-[#0A0A0B]">

      {/* File Explorer — collapsible */}
      <div className={cn(
        'flex-shrink-0 border-r border-zinc-800/50 flex flex-col transition-all duration-200',
        explorerOpen ? 'w-52' : 'w-0 overflow-hidden',
      )}>
        <FileExplorer onFileSelect={handleFileSelect} activeFile={selectedFile} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Tab bar */}
        <div className="flex-shrink-0 flex items-center gap-0.5 px-2 py-1.5 border-b border-zinc-800/50 bg-zinc-950/50">

          {/* Explorer toggle */}
          <button
            onClick={() => setExplorerOpen(o => !o)}
            title={explorerOpen ? 'Hide explorer' : 'Show explorer'}
            className="mr-1 p-1.5 rounded text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/50 transition-colors"
          >
            {explorerOpen
              ? <PanelLeftClose className="w-4 h-4" />
              : <PanelLeftOpen  className="w-4 h-4" />}
          </button>

          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'team' && teamModeActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
              )}
            </button>
          ))}

          {/* Loading indicator */}
          {loadingFile && (
            <span className="ml-auto text-[10px] text-zinc-600 animate-pulse pr-2">Loading…</span>
          )}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'editor' && (
            <CodeEditor
              file={selectedFile}
              content={fileContent}
              language={language}
              onChange={handleContentChange}
              onSave={handleSave}
              unsaved={unsaved}
            />
          )}
          {activeTab === 'patch' && (
            <PatchWorkflow
              activeFile={selectedFile}
              fileContent={fileContent}
            />
          )}
          {activeTab === 'git' && (
            <GitPanel />
          )}
          {activeTab === 'team' && (
            <TeamMode
              fileContext={selectedFile ?? undefined}
              onPatchReady={() => setActiveTab('patch')}
            />
          )}
          {activeTab === 'terminal' && (
            <TerminalPanel />
          )}
        </div>
      </div>
    </div>
  )
}
