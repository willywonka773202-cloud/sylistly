import { NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'

// Node.js runtime required — checks localhost daemon and reads process.env
export const runtime = 'nodejs'

// ── GET /api/agent/status ─────────────────────────────────────────────────────

export async function GET() {
  // ── Check daemon ────────────────────────────────────────────────────────────
  let daemonRunning = false
  const daemonUrl   = 'http://localhost:3001'

  try {
    const res = await fetch(`${daemonUrl}/health`, {
      signal: AbortSignal.timeout(500),
    })
    daemonRunning = res.ok
  } catch {
    daemonRunning = false
  }

  // ── Deployment config ───────────────────────────────────────────────────────
  const cfg = getOllamaConfig()

  // ── Provider availability ───────────────────────────────────────────────────
  const providers: Record<string, { available: boolean; label: string }> = {
    ollama: {
      available: true, // always structurally available; actual reachability checked by daemon
      label:     cfg.mode === 'cloud' ? 'Ollama Cloud' : 'Ollama Local',
    },
    anthropic: {
      available: !!process.env.ANTHROPIC_API_KEY,
      label:     'Anthropic (Claude)',
    },
    openai: {
      available: !!process.env.OPENAI_API_KEY,
      label:     'OpenAI',
    },
    gemini: {
      available: !!process.env.GEMINI_API_KEY,
      label:     'Google Gemini',
    },
  }

  return NextResponse.json({
    daemon: {
      running: daemonRunning,
      url:     daemonUrl,
    },
    deployment: {
      mode:         cfg.mode,
      provider:     cfg.providerName,
      chatUrl:      cfg.chatUrl,
      defaultModel: cfg.defaultModel,
    },
    providers,
    version:   '1.0.0',
    timestamp: Date.now(),
  })
}
