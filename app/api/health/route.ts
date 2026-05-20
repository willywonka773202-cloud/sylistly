import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  return NextResponse.json({
    // Subscription CLI providers — availability requires local process check (Node.js only)
    // These are marked false server-side; the client checks via /api/cli/status if needed
    'claude-code': false,
    'gemini-cli':  false,
    'codex-cli':   false,

    // Optional API providers — available if key is set in server env
    'claude-api':  !!process.env.ANTHROPIC_API_KEY,
    'openai-api':  !!process.env.OPENAI_API_KEY,
    'gemini-api':  !!process.env.GEMINI_API_KEY,

    // Whether API providers are globally enabled
    enableApiProviders: process.env.ENABLE_API_PROVIDERS === 'true',
  })
}
