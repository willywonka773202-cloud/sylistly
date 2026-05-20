'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Save, Copy, WrapText, Loader2, FileCode,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ── Monaco dynamic import (SSR safe) ──────────────────────────────────────────

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────────────────

interface CodeEditorProps {
  file: string | null
  content: string
  language: string
  onChange: (value: string) => void
  onSave: () => void
  unsaved: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getBreadcrumbs(file: string): string[] {
  return file.split('/').filter(Boolean)
}

function getLanguageLabel(language: string): string {
  const labels: Record<string, string> = {
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    typescriptreact: 'TSX',
    javascriptreact: 'JSX',
    python: 'Python',
    markdown: 'Markdown',
    json: 'JSON',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
    shellscript: 'Shell',
    yaml: 'YAML',
    toml: 'TOML',
    rust: 'Rust',
    go: 'Go',
  }
  return labels[language] ?? language
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-zinc-900/50">
      <div className="w-12 h-12 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center">
        <FileCode className="w-6 h-6 text-zinc-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-500">No file open</p>
        <p className="text-xs text-zinc-600 mt-0.5">
          Select a file from the explorer
        </p>
      </div>
    </div>
  )
}

// ── Editor Loading ─────────────────────────────────────────────────────────────

function EditorLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-900/50">
      <div className="flex items-center gap-2 text-zinc-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Initializing editor…</span>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CodeEditor({
  file,
  content,
  language,
  onChange,
  onSave,
  unsaved,
}: CodeEditorProps) {
  const [wordWrap, setWordWrap]     = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [lineCount, setLineCount]   = useState(0)
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorCol, setCursorCol]   = useState(1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)

  // Track mount for SSR safety
  useEffect(() => { setMounted(true) }, [])

  // Derive line count from content
  useEffect(() => {
    setLineCount(content ? content.split('\n').length : 0)
  }, [content])

  // Ctrl+S save handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSave])

  // Copy path to clipboard
  const handleCopyPath = useCallback(() => {
    if (file) navigator.clipboard.writeText(file).catch(() => null)
  }, [file])

  // Monaco mount callback
  const handleEditorMount = useCallback(
    (editor: NonNullable<typeof editorRef.current>) => {
      editorRef.current = editor

      // Track cursor position
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.onDidChangeCursorPosition((e: any) => {
        setCursorLine(e.position.lineNumber)
        setCursorCol(e.position.column)
      })
    },
    [],
  )

  const fileSizeBytes = new TextEncoder().encode(content).length

  // ── Breadcrumb segments ────────────────────────────────────────────────────
  const crumbs = file ? getBreadcrumbs(file) : []

  return (
    <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900 min-h-[40px]">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0 text-xs">
          {file ? (
            crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i < crumbs.length - 1 ? (
                  <>
                    <span className="text-zinc-600 truncate">{crumb}</span>
                    <span className="text-zinc-700 flex-shrink-0">/</span>
                  </>
                ) : (
                  <span className="text-zinc-300 font-medium truncate">{crumb}</span>
                )}
              </span>
            ))
          ) : (
            <span className="text-zinc-600">No file selected</span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Language badge */}
          {file && (
            <Badge variant="default" className="text-[10px] h-5">
              {getLanguageLabel(language)}
            </Badge>
          )}

          {/* Unsaved dot */}
          {unsaved && (
            <div
              className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0"
              title="Unsaved changes"
            />
          )}

          {/* Word wrap toggle */}
          {file && (
            <button
              onClick={() => setWordWrap(w => !w)}
              title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
              className={cn(
                'p-1 rounded transition-colors',
                wordWrap
                  ? 'text-violet-400 bg-violet-500/10'
                  : 'text-zinc-600 hover:text-zinc-400',
              )}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Copy path */}
          {file && (
            <button
              onClick={handleCopyPath}
              title="Copy file path"
              className="p-1 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Save */}
          {file && (
            <Button
              size="sm"
              variant={unsaved ? 'default' : 'secondary'}
              onClick={onSave}
              className="h-6 text-[11px] px-2"
            >
              <Save className="w-3 h-3" />
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Editor body */}
      {!file ? (
        <EmptyState />
      ) : !mounted ? (
        <EditorLoading />
      ) : (
        <div className="flex-1 overflow-hidden">
          <MonacoEditor
            height="100%"
            language={language}
            value={content}
            theme="vs-dark"
            loading={<EditorLoading />}
            onChange={val => onChange(val ?? '')}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              tabSize: 2,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: wordWrap ? 'on' : 'off',
              padding: { top: 8, bottom: 8 },
              fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
              fontLigatures: true,
              renderLineHighlight: 'gutter',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              bracketPairColorization: { enabled: true },
              guides: { indentation: true },
            }}
          />
        </div>
      )}

      {/* Status bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1 border-t border-zinc-800 bg-zinc-950/60 text-[10px] text-zinc-600">
        {file ? (
          <>
            <span>
              Ln {cursorLine}, Col {cursorCol}
            </span>
            <span className="text-zinc-800">|</span>
            <span>{lineCount} lines</span>
            <span className="text-zinc-800">|</span>
            <span>{getLanguageLabel(language)}</span>
            <span className="text-zinc-800">|</span>
            <span>{formatBytes(fileSizeBytes)}</span>
            <span className="text-zinc-800">|</span>
            <span>UTF-8</span>
            {unsaved && (
              <>
                <span className="text-zinc-800">|</span>
                <span className="text-orange-400">Unsaved changes</span>
              </>
            )}
          </>
        ) : (
          <span>No file open</span>
        )}
      </div>
    </div>
  )
}
