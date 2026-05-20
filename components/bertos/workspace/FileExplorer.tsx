'use client'

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Code2, Braces, FileText, FileJson, Palette, Terminal, File,
  Folder, FolderOpen, ChevronRight, RefreshCw,
  Search, Clock, WifiOff, Copy, Eye,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
  language?: string
  size?: number
}

interface FileExplorerProps {
  onFileSelect: (path: string) => void
  activeFile: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAEMON_URL = 'http://localhost:3001'
const RECENT_FILES_KEY = 'bertos:recent-files'
const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build'])
const MAX_RECENT = 5

// ── Helpers ────────────────────────────────────────────────────────────────────

function getFileIcon(name: string): { Icon: React.ElementType; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'tsx' || ext === 'jsx') return { Icon: Code2,    color: 'text-blue-400' }
  if (ext === 'ts'  || ext === 'js')  return { Icon: Braces,   color: 'text-yellow-400' }
  if (ext === 'md'  || ext === 'mdx') return { Icon: FileText, color: 'text-zinc-400' }
  if (ext === 'json')                 return { Icon: FileJson,  color: 'text-orange-400' }
  if (ext === 'css' || ext === 'scss' || ext === 'sass') return { Icon: Palette, color: 'text-pink-400' }
  if (ext === 'sh'  || ext === 'mjs') return { Icon: Terminal, color: 'text-green-400' }
  return { Icon: File, color: 'text-zinc-500' }
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
  if (!query) return nodes
  const q = query.toLowerCase()
  const result: FileNode[] = []
  for (const node of nodes) {
    if (node.type === 'dir' && node.children) {
      const filtered = filterTree(node.children, q)
      if (filtered.length > 0) result.push({ ...node, children: filtered })
    } else if (node.type === 'file' && node.name.toLowerCase().includes(q)) {
      result.push(node)
    }
  }
  return result
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  for (const node of nodes) {
    if (node.type === 'file') result.push(node)
    if (node.type === 'dir' && node.children) {
      result.push(...flattenFiles(node.children))
    }
  }
  return result
}

function loadRecentFiles(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(RECENT_FILES_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecentFile(path: string): void {
  if (typeof window === 'undefined') return
  const recent = loadRecentFiles().filter(p => p !== path)
  recent.unshift(path)
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

function pruneIgnored(nodes: FileNode[]): FileNode[] {
  return nodes
    .filter(n => !IGNORED_DIRS.has(n.name))
    .map(n =>
      n.type === 'dir' && n.children
        ? { ...n, children: pruneIgnored(n.children) }
        : n,
    )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-2 space-y-1.5 animate-pulse">
      {[40, 60, 80, 55, 70, 50, 90, 65].map((w, i) => (
        <div
          key={i}
          className="h-5 rounded bg-zinc-800"
          style={{ width: `${w}%`, marginLeft: `${(i % 3) * 12}px` }}
        />
      ))}
    </div>
  )
}

// ── Context Menu ───────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number
  y: number
  node: FileNode
  onClose: () => void
  onReveal: (path: string) => void
}

function ContextMenu({ x, y, node, onClose, onReveal }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-44 text-xs"
      style={{ left: x, top: y }}
    >
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 text-zinc-300 hover:bg-white/10 transition-colors"
        onClick={() => {
          navigator.clipboard.writeText(node.path).catch(() => null)
          onClose()
        }}
      >
        <Copy className="w-3.5 h-3.5 text-zinc-500" />
        Copy path
      </button>
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 text-zinc-300 hover:bg-white/10 transition-colors"
        onClick={() => { onReveal(node.path); onClose() }}
      >
        <Eye className="w-3.5 h-3.5 text-zinc-500" />
        Reveal in tree
      </button>
    </motion.div>
  )
}

// ── FileTreeNode ───────────────────────────────────────────────────────────────

interface FileNodeProps {
  node: FileNode
  depth: number
  activeFile: string | null
  focusedPath: string | null
  onSelect: (node: FileNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  defaultOpen?: boolean
}

function FileTreeNode({
  node, depth, activeFile, focusedPath, onSelect, onContextMenu, defaultOpen = false,
}: FileNodeProps) {
  const [open, setOpen] = useState(defaultOpen || depth < 1)
  const isDir = node.type === 'dir'
  const { Icon, color } = isDir
    ? { Icon: open ? FolderOpen : Folder, color: 'text-yellow-400' }
    : getFileIcon(node.name)

  const isActive  = activeFile === node.path
  const isFocused = focusedPath === node.path

  return (
    <div>
      <button
        data-path={node.path}
        onContextMenu={e => onContextMenu(e, node)}
        onClick={() => (isDir ? setOpen(o => !o) : onSelect(node))}
        className={cn(
          'flex items-center gap-1.5 w-full text-xs rounded transition-colors text-left group',
          'py-[3px] pr-2',
          isActive  && 'bg-violet-600/25 text-violet-200',
          isFocused && !isActive && 'bg-white/10 text-zinc-200',
          !isActive && !isFocused && 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {isDir ? (
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0"
          >
            <ChevronRight className="w-3 h-3 text-zinc-600" />
          </motion.span>
        ) : (
          <span className="w-3 h-3 flex-shrink-0" />
        )}
        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
        <span className="truncate flex-1">{node.name}</span>
      </button>

      <AnimatePresence initial={false}>
        {isDir && open && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                focusedPath={focusedPath}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function FileExplorer({ onFileSelect, activeFile }: FileExplorerProps) {
  const [tree, setTree]               = useState<FileNode[]>([])
  const [loading, setLoading]         = useState(true)
  const [offline, setOffline]         = useState(false)
  const [search, setSearch]           = useState('')
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null)

  const allFiles     = flattenFiles(tree)
  const displayTree  = search ? filterTree(tree, search) : tree
  const visibleFiles = flattenFiles(displayTree)

  // ── Fetch tree ─────────────────────────────────────────────────────────────
  const fetchTree = useCallback(async () => {
    setLoading(true)
    setOffline(false)
    try {
      const res = await fetch(`${DAEMON_URL}/repo/files`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: FileNode[] = await res.json()
      setTree(pruneIgnored(data))
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTree()
    setRecentFiles(loadRecentFiles())
  }, [fetchTree])

  // ── File selection ──────────────────────────────────────────────────────────
  const handleSelect = useCallback((node: FileNode) => {
    if (node.type !== 'file') return
    setFocusedPath(node.path)
    onFileSelect(node.path)
    saveRecentFile(node.path)
    setRecentFiles(loadRecentFiles())
  }, [onFileSelect])

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = focusedPath
      ? visibleFiles.findIndex(f => f.path === focusedPath)
      : -1

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = visibleFiles[currentIdx + 1]
      if (next) setFocusedPath(next.path)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = visibleFiles[currentIdx - 1]
      if (prev) setFocusedPath(prev.path)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedPath) {
        const node = allFiles.find(f => f.path === focusedPath)
        if (node) handleSelect(node)
      }
    }
  }, [focusedPath, visibleFiles, allFiles, handleSelect])

  // ── Context menu ────────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const revealInTree = useCallback((path: string) => {
    const el = document.querySelector(`[data-path="${CSS.escape(path)}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    setFocusedPath(path)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full bg-zinc-900 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-zinc-800">
        <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">
          Explorer
        </span>
        <button
          onClick={fetchTree}
          className="p-0.5 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-1.5 bg-zinc-800/60 rounded px-2 py-1">
          <Search className="w-3 h-3 text-zinc-600 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter files..."
            className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none min-w-0"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-zinc-600 hover:text-zinc-400 text-[10px]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Offline state */}
      {offline && (
        <div className="flex-shrink-0 m-2 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-medium">Local daemon offline</span>
          </div>
          <p className="text-[10px] text-zinc-500 mb-2 font-mono">
            npm run bertos:daemon
          </p>
          <Button size="sm" variant="secondary" onClick={fetchTree} className="w-full text-[10px] h-6">
            Retry connection
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && !offline && <Skeleton />}

      {/* Tree + Recent */}
      {!loading && !offline && (
        <ScrollArea className="flex-1">
          {/* Recent files */}
          {recentFiles.length > 0 && !search && (
            <div className="mb-1">
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <Clock className="w-3 h-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
                  Recent
                </span>
              </div>
              {recentFiles.map(path => {
                const name = path.split('/').pop() ?? path
                const { Icon, color } = getFileIcon(name)
                return (
                  <button
                    key={path}
                    data-path={path}
                    onClick={() => { onFileSelect(path); saveRecentFile(path); setRecentFiles(loadRecentFiles()) }}
                    onContextMenu={e => handleContextMenu(e, { name, path, type: 'file' })}
                    className={cn(
                      'flex items-center gap-1.5 w-full px-3 py-[3px] text-xs transition-colors text-left',
                      activeFile === path
                        ? 'bg-violet-600/25 text-violet-200'
                        : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
                    )}
                  >
                    <Icon className={cn('w-3 h-3 flex-shrink-0', color)} />
                    <span className="truncate">{name}</span>
                  </button>
                )
              })}
              <div className="mx-3 my-1 border-t border-zinc-800/60" />
            </div>
          )}

          {/* File tree */}
          <div className="py-0.5">
            {displayTree.length === 0 && search ? (
              <div className="px-3 py-4 text-xs text-zinc-600 text-center">
                No files match &ldquo;{search}&rdquo;
              </div>
            ) : (
              displayTree.map(node => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  activeFile={activeFile}
                  focusedPath={focusedPath}
                  onSelect={handleSelect}
                  onContextMenu={handleContextMenu}
                  defaultOpen={true}
                />
              ))
            )}
          </div>
        </ScrollArea>
      )}

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            onClose={() => setContextMenu(null)}
            onReveal={revealInTree}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
