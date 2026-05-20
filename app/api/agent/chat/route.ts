import { NextRequest, NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { resolveOllamaModel } from '@/lib/bertos/providers'

// Node.js runtime required — reads env vars and makes localhost calls
export const runtime = 'nodejs'

// ── Auth ──────────────────────────────────────────────────────────────────────

function checkAuth(req: NextRequest): { ok: boolean; devMode: boolean } {
  const envSecret = process.env.BERTOS_AGENT_SECRET?.trim()

  // If no secret is configured, allow without auth (dev mode)
  if (!envSecret) {
    console.warn('[BertOS] BERTOS_AGENT_SECRET not set — running in dev mode, auth disabled')
    return { ok: true, devMode: true }
  }

  const provided = req.headers.get('x-bertos-secret')?.trim()
  if (!provided || provided !== envSecret) {
    return { ok: false, devMode: false }
  }

  return { ok: true, devMode: false }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = checkAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    message?: string
    model?: string
    systemPrompt?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = body.message?.trim()
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const systemPrompt =
    body.systemPrompt ||
    'You are BertOS, an advanced AI assistant. Be precise, thorough, and helpful.'

  // ── Resolve Ollama config ─────────────────────────────────────────────────
  const cfg        = getOllamaConfig()
  const modelAlias = body.model?.trim() || 'auto'
  const ollamaModel = resolveOllamaModel(modelAlias)

  const ollamaMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: message },
  ]

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[BertOS Agent] mode=${cfg.mode} model=${ollamaModel} endpoint=${new URL(cfg.chatUrl).origin}`
    )
  }

  let ollamaRes: Response
  try {
    ollamaRes = await fetch(cfg.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model:    ollamaModel,
        messages: ollamaMessages,
        stream:   true,
      }),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Ollama unreachable: ${msg}` }, { status: 503 })
  }

  if (!ollamaRes.ok) {
    let detail = `HTTP ${ollamaRes.status}`
    try {
      const errBody = await ollamaRes.json() as { error?: string; message?: string }
      detail = errBody.error ?? errBody.message ?? detail
    } catch { /* body not JSON */ }
    return NextResponse.json({ error: `Ollama error: ${detail}` }, { status: 502 })
  }

  // ── Pipe Ollama stream as SSE ─────────────────────────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const done = () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }

      try {
        if (!ollamaRes.body) throw new Error('No response body from Ollama.')

        const reader  = ollamaRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line) as {
                message?: { content?: string }
                response?: string
                done?: boolean
              }
              const text = chunk.message?.content ?? chunk.response ?? ''
              if (text) send({ text })
            } catch { /* skip malformed NDJSON */ }
          }
        }

        done()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Stream error'
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch { /* controller already closed */ }
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
