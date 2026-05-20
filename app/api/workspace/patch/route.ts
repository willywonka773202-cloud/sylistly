import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { getOllamaConfig, getBertOSDeploymentMode } from '@/lib/bertos/runtime'
import { resolveOllamaModel } from '@/lib/bertos/providers'

export const runtime = 'nodejs'

// ── Prompts ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert software engineer. Generate a unified diff patch for the requested change.
Return ONLY the unified diff format. No explanation before or after.
Start with --- and +++ headers.
Use standard unified diff format with @@ hunk headers.
Be precise — only change what is requested.`

function buildUserMessage(file: string, content: string, prompt: string, repoContext?: string): string {
  let msg = `File: ${file}\n\nCurrent content:\n\`\`\`\n${content}\n\`\`\`\n\nRequested change: ${prompt}`
  if (repoContext?.trim()) {
    msg += `\n\nRepository context:\n${repoContext}`
  }
  return msg
}

// ── SSE helpers ────────────────────────────────────────────────────────────────

const encoder = new TextEncoder()

function sseChunk(text: string): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
}

function sseDone(): Uint8Array {
  return encoder.encode('data: [DONE]\n\n')
}

function sseError(message: string): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    prompt?: string
    file?: string
    content?: string
    provider?: string
    repoContext?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const prompt     = body.prompt?.trim() ?? ''
  const file       = body.file?.trim() ?? 'untitled'
  const content    = body.content ?? ''
  const provider   = body.provider?.toLowerCase() ?? 'auto'
  const repoContext = body.repoContext

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const userMessage = buildUserMessage(file, content, prompt, repoContext)

  // ── Build SSE stream ─────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: Uint8Array) => {
        try { controller.enqueue(chunk) } catch { /* already closed */ }
      }
      const close = () => {
        try { controller.close() } catch { /* already closed */ }
      }

      try {
        // ── Anthropic (claude-code / claude-api) ──────────────────────────
        if (provider === 'claude-code' || provider === 'claude-api') {
          const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
          if (!apiKey) {
            send(sseError('ANTHROPIC_API_KEY is not configured.'))
            send(sseDone())
            close()
            return
          }
          const client = new Anthropic({ apiKey })
          const apiStream = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
            stream: true,
          })
          for await (const event of apiStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send(sseChunk(event.delta.text))
            }
          }
          send(sseDone())
          close()
          return
        }

        // ── OpenAI (codex-cli / openai-api) ─────────────────────────────
        if (provider === 'codex-cli' || provider === 'openai-api' || provider === 'codex') {
          const apiKey = process.env.OPENAI_API_KEY?.trim()
          if (!apiKey) {
            send(sseError('OPENAI_API_KEY is not configured.'))
            send(sseDone())
            close()
            return
          }
          const client = new OpenAI({ apiKey })
          const openaiStream = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user',   content: userMessage },
            ],
            stream: true,
            max_tokens: 4096,
          })
          for await (const chunk of openaiStream) {
            const text = chunk.choices[0]?.delta?.content
            if (text) send(sseChunk(text))
          }
          send(sseDone())
          close()
          return
        }

        // ── Google Gemini (gemini-cli / gemini-api) ──────────────────────
        if (provider === 'gemini-cli' || provider === 'gemini-api' || provider === 'gemini') {
          const apiKey = process.env.GEMINI_API_KEY?.trim()
          if (!apiKey) {
            send(sseError('GEMINI_API_KEY is not configured.'))
            send(sseDone())
            close()
            return
          }
          const client = new GoogleGenAI({ apiKey })
          const geminiStream = await client.models.generateContentStream({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            config: { systemInstruction: SYSTEM_PROMPT },
          })
          for await (const chunk of geminiStream) {
            const text = chunk.text
            if (text) send(sseChunk(text))
          }
          send(sseDone())
          close()
          return
        }

        // ── Cloud-mode guard: no Ollama in Vercel deploys ────────────────
        const mode = getBertOSDeploymentMode()
        if (mode === 'cloud') {
          send(sseError(
            'Patch generation requires a local daemon or API key in cloud mode. ' +
            'Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY, then select the matching provider.',
          ))
          send(sseDone())
          close()
          return
        }

        // ── Ollama (default / auto / ollama-pro) ─────────────────────────
        const cfg = getOllamaConfig()
        const ollamaModel = resolveOllamaModel(
          provider === 'ollama-pro' ? 'ollama-pro' : cfg.defaultModel,
        )

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (cfg.requiresApiKey && cfg.apiKey) {
          headers['Authorization'] = `Bearer ${cfg.apiKey}`
        }

        const ollamaRes = await fetch(cfg.chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user',   content: userMessage },
            ],
            stream: true,
          }),
        })

        if (!ollamaRes.ok) {
          let detail = `HTTP ${ollamaRes.status}`
          try {
            const errBody = await ollamaRes.json() as { error?: string }
            detail = errBody.error ?? detail
          } catch { /* not JSON */ }
          throw new Error(`Ollama: ${detail}`)
        }

        if (!ollamaRes.body) throw new Error('No response body from Ollama.')

        const reader  = ollamaRes.body.getReader()
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
            try {
              const data = JSON.parse(line) as {
                message?: { content?: string }
                response?: string
                done?: boolean
              }
              const text = data.message?.content ?? data.response ?? ''
              if (text) send(sseChunk(text))
            } catch { /* skip malformed NDJSON */ }
          }
        }

        send(sseDone())
        close()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Patch generation failed'
        send(sseError(message))
        send(sseDone())
        close()
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
