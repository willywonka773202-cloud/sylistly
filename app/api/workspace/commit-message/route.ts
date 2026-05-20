import { NextRequest, NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { resolveOllamaModel } from '@/lib/bertos/providers'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { changes?: string[] }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const changes = body.changes ?? []

  if (changes.length === 0) {
    return NextResponse.json({ error: 'No changed files provided' }, { status: 400 })
  }

  const prompt =
    `Generate a concise git commit message (imperative mood, under 72 chars) for these changed files: ` +
    `${changes.join(', ')}. Reply with ONLY the commit message on a single line. No explanation. No prefix. No quotes.`

  const cfg = getOllamaConfig()
  const model = resolveOllamaModel(cfg.defaultModel)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.requiresApiKey && cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`
  }

  try {
    const res = await fetch(cfg.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const errBody = await res.json() as { error?: string }
        detail = errBody.error ?? detail
      } catch { /* not JSON */ }
      return NextResponse.json({ error: `Ollama error: ${detail}` }, { status: 502 })
    }

    const data = await res.json() as {
      message?: { content?: string }
      response?: string
    }

    const rawMessage = (data.message?.content ?? data.response ?? '').trim()

    if (!rawMessage) {
      return NextResponse.json({ error: 'Empty response from model' }, { status: 502 })
    }

    // Take only the first non-blank line that looks like a commit message
    const cleanMessage = rawMessage
      .split('\n')
      .map(l => l.trim().replace(/^["'`]|["'`]$/g, ''))
      .filter(l => l.length > 0 && !l.match(/^(here|this|the following|note:|explanation:|commit message:)/i))
      [0] ?? rawMessage.trim()

    return NextResponse.json({ message: cleanMessage })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
