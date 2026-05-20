import { NextRequest, NextResponse } from 'next/server'

// Node.js runtime required — proxies requests to the Hermes agent
export const runtime = 'nodejs'

// ── POST /api/hermes/message ──────────────────────────────────────────────────
//
// Forwards a message to the Hermes agent and pipes back the response.
// If Hermes returns SSE, pipes it through as SSE.
// If Hermes returns JSON, wraps it in an SSE stream.

export async function POST(req: NextRequest) {
  const hermesUrl = process.env.HERMES_API_URL?.trim()
  const hermesKey = process.env.HERMES_API_KEY?.trim() || ''

  if (!hermesUrl) {
    return NextResponse.json(
      { error: 'Hermes not configured. Set HERMES_API_URL in env.' },
      { status: 503 }
    )
  }

  let body: {
    message?: string
    workspaceId?: string
    stream?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const chatUrl = hermesUrl.replace(/\/$/, '') + '/chat'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (hermesKey) headers['Authorization'] = `Bearer ${hermesKey}`

  let hermesRes: Response
  try {
    hermesRes = await fetch(chatUrl, {
      method:  'POST',
      headers,
      body:    JSON.stringify({
        message:     body.message,
        workspaceId: body.workspaceId,
        stream:      body.stream ?? true,
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Failed to reach Hermes: ${message}` },
      { status: 502 }
    )
  }

  if (!hermesRes.ok) {
    let detail = `HTTP ${hermesRes.status}`
    try {
      const errBody = await hermesRes.json() as { error?: string; message?: string }
      detail = errBody.error ?? errBody.message ?? detail
    } catch { /* body not JSON */ }
    return NextResponse.json(
      { error: `Hermes error: ${detail}` },
      { status: hermesRes.status >= 500 ? 502 : hermesRes.status }
    )
  }

  const upstreamContentType = hermesRes.headers.get('content-type') || ''
  const isSSE = upstreamContentType.includes('text/event-stream')

  // ── If Hermes is streaming SSE, pipe it straight through ──────────────────
  if (isSSE && hermesRes.body) {
    return new NextResponse(hermesRes.body, {
      headers: {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache, no-transform',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // ── If Hermes returns JSON, wrap it in a single SSE event ─────────────────
  if (upstreamContentType.includes('application/json') || !hermesRes.body) {
    let json: unknown
    try {
      json = await hermesRes.json()
    } catch {
      json = {}
    }

    const encoder = new TextEncoder()
    const stream  = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(json)}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
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

  // ── Fallback: stream whatever Hermes sent as SSE ──────────────────────────
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!hermesRes.body) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        const reader  = hermesRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            // Try to parse as JSON and forward as SSE data
            try {
              const parsed = JSON.parse(line)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`))
            } catch {
              // Forward raw text as an SSE message
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: line })}\n\n`)
              )
            }
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Stream error'
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          )
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
