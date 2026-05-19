'use client'
import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, GitBranch, Play, Terminal, FileText, FolderOpen,
  ChevronRight, ChevronDown, Plus, RefreshCw, Check, X,
  Diff, Eye, Save
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

type DiffStatus = 'pending' | 'approved' | 'rejected'

interface AIDiff {
  id: string
  file: string
  description: string
  additions: number
  deletions: number
  diff: string
  status: DiffStatus
}

interface FileNode {
  name: string
  type: 'file' | 'dir'
  children?: FileNode[]
  content?: string
  language?: string
  modified?: boolean
}

const DEMO_TREE: FileNode[] = [
  {
    name: 'src', type: 'dir', children: [
      {
        name: 'components', type: 'dir', children: [
          { name: 'Button.tsx', type: 'file', language: 'tsx', content: `import { cn } from '@/lib/utils'\n\ninterface ButtonProps {\n  variant?: 'primary' | 'secondary'\n  children: React.ReactNode\n  onClick?: () => void\n}\n\nexport function Button({ variant = 'primary', children, onClick }: ButtonProps) {\n  return (\n    <button\n      onClick={onClick}\n      className={cn(\n        'px-4 py-2 rounded-lg font-medium transition-all',\n        variant === 'primary' && 'bg-violet-600 text-white hover:bg-violet-500',\n        variant === 'secondary' && 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'\n      )}\n    >\n      {children}\n    </button>\n  )\n}` },
          { name: 'Card.tsx', type: 'file', language: 'tsx', modified: true },
        ]
      },
      { name: 'lib', type: 'dir', children: [
        { name: 'utils.ts', type: 'file', language: 'ts' },
        { name: 'api.ts', type: 'file', language: 'ts', modified: true },
      ]},
      { name: 'app', type: 'dir', children: [
        { name: 'page.tsx', type: 'file', language: 'tsx' },
        { name: 'layout.tsx', type: 'file', language: 'tsx' },
      ]}
    ]
  },
  { name: 'package.json', type: 'file', language: 'json' },
  { name: 'tsconfig.json', type: 'file', language: 'json' },
  { name: 'README.md', type: 'file', language: 'md' },
]

const AI_DIFFS: AIDiff[] = [
  {
    id: '1',
    file: 'src/lib/api.ts',
    description: 'Add error handling and retry logic to API calls',
    additions: 12,
    deletions: 3,
    diff: `- export async function fetchData(url: string) {
-   const res = await fetch(url)
-   return res.json()
- }
+ export async function fetchData(url: string, retries = 3): Promise<unknown> {
+   for (let i = 0; i < retries; i++) {
+     try {
+       const res = await fetch(url)
+       if (!res.ok) throw new Error(\`HTTP \${res.status}\`)
+       return res.json()
+     } catch (err) {
+       if (i === retries - 1) throw err
+       await new Promise(r => setTimeout(r, 1000 * 2 ** i))
+     }
+   }
+ }`,
    status: 'pending' as const,
  },
  {
    id: '2',
    file: 'src/components/Card.tsx',
    description: 'Extract Card into reusable component with variants',
    additions: 24,
    deletions: 8,
    diff: `+ interface CardProps {
+   variant?: 'default' | 'elevated' | 'bordered'
+   children: React.ReactNode
+   className?: string
+ }
+
+ export function Card({ variant = 'default', children, className }: CardProps) {
+   return (
+     <div className={cn(
+       'rounded-xl p-4 transition-all',
+       variant === 'default' && 'bg-zinc-900 border border-zinc-800',
+       variant === 'elevated' && 'bg-zinc-800 shadow-lg',
+       variant === 'bordered' && 'border-2 border-zinc-700',
+       className
+     )}>
+       {children}
+     </div>
+   )
+ }`,
    status: 'approved' as const,
  },
]

function FileTreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const isDir = node.type === 'dir'

  return (
    <div>
      <button
        onClick={() => isDir && setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded hover:bg-white/5 transition-colors text-left group',
          !isDir && 'cursor-pointer hover:text-zinc-200'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {isDir ? (
          open ? <ChevronDown className="w-3 h-3 text-zinc-600 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
        ) : (
          <FileText className="w-3 h-3 text-zinc-600 flex-shrink-0" />
        )}
        <span className={cn(
          'flex-1 truncate',
          isDir ? 'text-zinc-400 font-medium' : 'text-zinc-500'
        )}>
          {node.name}
        </span>
        {node.modified && (
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
        )}
      </button>
      {isDir && open && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function DiffBlock({ diff, additions, deletions }: { diff: string; additions: number; deletions: number }) {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 font-mono text-xs">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-1.5">
          <Diff className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-500">Diff</span>
        </div>
        <span className="text-emerald-400">+{additions}</span>
        <span className="text-red-400">-{deletions}</span>
      </div>
      <pre className="p-4 overflow-x-auto leading-relaxed">
        {diff.split('\n').map((line, i) => (
          <div
            key={i}
            className={cn(
              'px-1 rounded',
              line.startsWith('+') && !line.startsWith('+++') && 'text-emerald-400 bg-emerald-400/5',
              line.startsWith('-') && !line.startsWith('---') && 'text-red-400 bg-red-400/5',
              !line.startsWith('+') && !line.startsWith('-') && 'text-zinc-500'
            )}
          >
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}

export function WorkspaceView() {
  const [diffs, setDiffs] = useState<AIDiff[]>(AI_DIFFS)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [terminalLines, setTerminalLines] = useState([
    '$ bertos workspace ready',
    '> Scanning repository...',
    '> Found 24 TypeScript files',
    '> 2 files with modifications detected',
    '$ _',
  ])

  const approveAll = () => {
    setDiffs(prev => prev.map(d => ({ ...d, status: 'approved' as const })))
  }

  const generateDiff = async () => {
    if (!aiPrompt.trim()) return
    setIsGenerating(true)
    setTerminalLines(prev => [...prev.slice(0, -1), `$ ai generate "${aiPrompt}"`, '> Analyzing codebase...', '$ _'])
    await new Promise(r => setTimeout(r, 2000))
    setTerminalLines(prev => [...prev.slice(0, -1), '> Generated 1 diff', '> Review in the patch panel', '$ _'])
    setIsGenerating(false)
    setAiPrompt('')
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* File tree */}
      <div className="w-52 flex-shrink-0 border-r border-zinc-800/50 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/50">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            <FolderOpen className="w-3 h-3" />
            Explorer
          </div>
          <button className="p-0.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-800/30">
          <GitBranch className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] text-zinc-500">main</span>
          <span className="text-[10px] text-zinc-700 ml-auto">2 modified</span>
        </div>
        <ScrollArea className="flex-1 py-1">
          {DEMO_TREE.map(node => (
            <FileTreeNode key={node.name} node={node} />
          ))}
        </ScrollArea>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* AI instruction bar */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/50 bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Code2 className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateDiff()}
              placeholder='Tell the AI what to do: "Add error handling to all API calls"...'
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-700 outline-none"
            />
            <Button size="sm" onClick={generateDiff} disabled={isGenerating || !aiPrompt.trim()}>
              {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
            <Button size="sm" variant="secondary" onClick={approveAll}>
              <Check className="w-3.5 h-3.5" />
              Approve All
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Diffs panel */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold text-zinc-400">AI-Generated Patches</h3>
              <Badge variant="info" className="text-[10px]">{diffs.length} patches</Badge>
            </div>

            {diffs.map(diff => (
              <motion.div
                key={diff.id}
                layout
                className={cn(
                  'rounded-xl border p-4 space-y-3 transition-colors',
                  diff.status === 'approved'
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-zinc-800 bg-zinc-900/50'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs text-violet-400 font-mono">{diff.file}</code>
                      <Badge
                        variant={diff.status === 'approved' ? 'success' : 'default'}
                        className="text-[9px]"
                      >
                        {diff.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400">{diff.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {diff.status !== 'approved' && (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDiffs(prev => prev.map(d => d.id === diff.id ? { ...d, status: 'rejected' as const } : d))}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDiffs(prev => prev.map(d => d.id === diff.id ? { ...d, status: 'approved' as const } : d))}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Apply
                        </Button>
                      </>
                    )}
                    {diff.status === 'approved' && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                        <Check className="w-3.5 h-3.5" />
                        Applied
                      </div>
                    )}
                  </div>
                </div>
                <DiffBlock diff={diff.diff} additions={diff.additions} deletions={diff.deletions} />
              </motion.div>
            ))}
          </div>

          {/* Terminal */}
          <div className="w-72 flex-shrink-0 border-l border-zinc-800/50 flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/50">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Terminal</span>
              <div className="ml-auto flex gap-1">
                {['bg-red-500', 'bg-amber-500', 'bg-emerald-500'].map(c => (
                  <div key={c} className={cn('w-2 h-2 rounded-full opacity-60', c)} />
                ))}
              </div>
            </div>
            <div className="flex-1 font-mono text-xs text-zinc-400 p-3 overflow-y-auto space-y-0.5 bg-zinc-950/50">
              {terminalLines.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    line.startsWith('$') ? 'text-emerald-400' :
                    line.startsWith('>') ? 'text-zinc-400' : 'text-zinc-600'
                  )}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
