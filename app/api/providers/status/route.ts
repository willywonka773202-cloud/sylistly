import { NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'

// Node.js runtime required — reads process.env
export const runtime = 'nodejs'

// ── GET /api/providers/status ─────────────────────────────────────────────────
//
// Returns detailed status of all configured providers.
// Does NOT do live pinging — checks env var presence and config only.

export async function GET() {
  const cfg = getOllamaConfig()

  return NextResponse.json({
    ollama: {
      available: true,
      mode:      cfg.mode,
      model:     cfg.defaultModel,
      url:       cfg.baseUrl,
      hasKey:    !!cfg.apiKey,
    },
    anthropic: {
      available: !!process.env.ANTHROPIC_API_KEY,
      hasKey:    !!process.env.ANTHROPIC_API_KEY,
    },
    openai: {
      available: !!process.env.OPENAI_API_KEY,
      hasKey:    !!process.env.OPENAI_API_KEY,
    },
    gemini: {
      available: !!process.env.GEMINI_API_KEY,
      hasKey:    !!process.env.GEMINI_API_KEY,
    },
    hermes: {
      available: !!process.env.HERMES_API_URL,
      url:       process.env.HERMES_API_URL || null,
      hasKey:    !!process.env.HERMES_API_KEY,
    },
  })
}
