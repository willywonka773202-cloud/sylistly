import { NextRequest, NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'

export const runtime = 'nodejs'

// Key BertOS files to analyze when the daemon is offline
const FALLBACK_FILE_LIST = [
  'components/bertos/shell/AppShell.tsx',
  'components/bertos/shell/Sidebar.tsx',
  'components/bertos/shell/TopBar.tsx',
  'components/bertos/shell/RightPanel.tsx',
  'components/bertos/chat/ChatView.tsx',
  'components/bertos/chat/InputBar.tsx',
  'components/bertos/chat/MessageBubble.tsx',
  'components/bertos/workspace/WorkspaceView.tsx',
  'components/bertos/workspace/TeamMode.tsx',
  'components/bertos/workspace/FileExplorer.tsx',
  'components/bertos/agents/AgentsView.tsx',
  'components/bertos/agents/EvolutionLab.tsx',
  'components/bertos/panels/SettingsView.tsx',
  'components/bertos/memory/MemoryView.tsx',
  'components/bertos/compare/CompareView.tsx',
  'components/bertos/command/CommandPalette.tsx',
  'app/api/chat/route.ts',
  'app/api/bertos/mode/route.ts',
  'app/api/ollama/status/route.ts',
  'app/api/evolution/scan/route.ts',
  'app/api/composio/status/route.ts',
  'app/api/hermes/status/route.ts',
  'lib/bertos/runtime.ts',
  'lib/bertos/router.ts',
  'lib/bertos/types.ts',
  'lib/bertos/providers/index.ts',
  'lib/bertos/providers/ollama.ts',
  'lib/bertos/providers/cli.ts',
  'store/bertos/ui.ts',
  'store/bertos/chat.ts',
  'store/bertos/agents.ts',
]

interface EvolutionSuggestion {
  id: string
  category: 'bug' | 'dead-code' | 'todo' | 'ui' | 'performance' | 'test'
  priority: 'critical' | 'high' | 'medium' | 'low'
  file: string
  title: string
  description: string
  impact: string
  risk: 'low' | 'medium' | 'high'
}

async function fetchFileTree(): Promise<string[]> {
  try {
    const res = await fetch('http://localhost:3001/repo/files', {
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { files?: string[] }
    if (Array.isArray(data.files) && data.files.length > 0) {
      return data.files
    }
  } catch {
    // Daemon offline — fall through to hardcoded list
  }
  return FALLBACK_FILE_LIST
}

export async function POST(req: NextRequest) {
  let body: { depth?: string } = {}
  try {
    body = await req.json()
  } catch { /* use defaults */ }

  const depth = body.depth ?? 'normal'

  const files = await fetchFileTree()
  const filesScanned = files.length

  // Build a representative summary for Ollama
  const fileListSummary = files
    .slice(0, depth === 'shallow' ? 15 : depth === 'deep' ? files.length : 30)
    .join('\n')

  const cfg = getOllamaConfig()

  const prompt = `Analyze this BertOS codebase structure and identify improvement opportunities.
Return a JSON array of suggestions with this structure:
[{
  "id": "unique-id",
  "category": "bug|dead-code|todo|ui|performance|test",
  "priority": "critical|high|medium|low",
  "file": "relative/path/to/file",
  "title": "short title",
  "description": "what to fix and why",
  "impact": "what improves if fixed",
  "risk": "low|medium|high"
}]

Return ONLY the JSON array. No markdown, no explanation.

File structure:
${fileListSummary}`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`

  let rawResponse = ''
  try {
    const res = await fetch(cfg.chatUrl, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: cfg.defaultModel,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`)
      return NextResponse.json({
        suggestions: [],
        error: `Ollama request failed: ${errText}`,
        scannedAt: Date.now(),
        filesScanned,
      })
    }

    const data = await res.json() as {
      message?: { content?: string }
      response?: string
    }
    rawResponse = data.message?.content ?? data.response ?? ''
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      suggestions: [],
      error: `Failed to connect to Ollama: ${message}`,
      scannedAt: Date.now(),
      filesScanned,
    })
  }

  // Strip optional markdown code fences
  const cleaned = rawResponse
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  try {
    const suggestions = JSON.parse(cleaned) as EvolutionSuggestion[]
    if (!Array.isArray(suggestions)) throw new Error('Not an array')
    return NextResponse.json({
      suggestions,
      scannedAt: Date.now(),
      filesScanned,
    })
  } catch {
    return NextResponse.json({
      suggestions: [],
      error: 'AI returned unparseable response',
      scannedAt: Date.now(),
      filesScanned,
    })
  }
}
