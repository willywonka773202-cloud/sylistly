import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { routePrompt } from '@/lib/bertos/router'
import type { Message } from '@/lib/bertos/types'
import { resolveOllamaModel, CLI_MODEL_ALIASES, API_MODEL_ALIASES } from '@/lib/bertos/providers'
import { getOllamaConfig } from '@/lib/bertos/runtime'

// Node.js runtime required:
// - reads process.env.VERCEL to detect cloud mode
// - no localhost calls in cloud mode
export const runtime = 'nodejs'

const API_MODEL_IDS: Record<string, string> = {
  'claude-api':  'claude-opus-4-5',
  'openai-api':  'gpt-4o',
  'gemini-api':  'gemini-2.0-flash',
}

interface ClientKeys {
  anthropic?: string
  openai?: string
  google?: string
}

function resolveKey(envKey: string | undefined, clientKey: string | undefined): string {
  return envKey?.trim() || clientKey?.trim() || ''
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: Message[]
    prompt?: string
    model?: string
    systemPrompt?: string
    clientKeys?: ClientKeys
    ollamaEndpoint?: string
    enableApiProviders?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ck = body.clientKeys ?? {}
  const anthropicKey = resolveKey(process.env.ANTHROPIC_API_KEY, ck.anthropic)
  const openaiKey    = resolveKey(process.env.OPENAI_API_KEY, ck.openai)
  const geminiKey    = resolveKey(process.env.GEMINI_API_KEY, ck.google)

  const messages: Message[] = body.messages ?? [{
    id: '1',
    role: 'user',
    content: body.prompt ?? '',
    timestamp: Date.now(),
  }]

  const systemMessages       = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')
  const systemPrompt = (body.systemPrompt
    ?? systemMessages.map(m => m.content).join('\n'))
    || 'You are BertOS, an advanced AI assistant. Be precise, thorough, and helpful.'

  const modelAlias = (body.model && body.model !== 'auto')
    ? body.model
    : routePrompt(
        conversationMessages[conversationMessages.length - 1]?.content ?? '',
        'auto'
      ).primary as string

  const routerDecision = body.model === 'auto'
    ? routePrompt(conversationMessages[conversationMessages.length - 1]?.content ?? '', 'auto')
    : { primary: modelAlias, reasoning: `Routed to ${modelAlias} as selected.`, confidence: 1, taskType: 'general', strategy: 'single' }

  const encoder = new TextEncoder()

  // Build an SSE ReadableStream
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
        send({ routerDecision })

        // ── CLI subscription providers ──────────────────────────────────
        if (CLI_MODEL_ALIASES.has(modelAlias)) {
          const cliLabels: Record<string, string> = {
            'claude-code': 'Claude Code CLI',
            'gemini-cli':  'Gemini CLI',
            'codex-cli':   'Codex CLI',
          }
          const installHints: Record<string, string> = {
            'claude-code': 'npm install -g @anthropic-ai/claude-code && claude login',
            'gemini-cli':  'npm install -g @google/gemini-cli && gemini auth login',
            'codex-cli':   'npm install -g @openai/codex && codex login',
          }
          throw new Error(
            `${cliLabels[modelAlias] ?? modelAlias} requires a local CLI process — ` +
            `not yet available in the web interface. ` +
            `Run BertOS locally and install: ${installHints[modelAlias] ?? ''}`
          )
        }

        // ── Optional API providers (disabled by default) ────────────────
        if (API_MODEL_ALIASES.has(modelAlias)) {
          const enableApi = body.enableApiProviders ?? (process.env.ENABLE_API_PROVIDERS === 'true')
          if (!enableApi) {
            throw new Error(
              `API providers are disabled by default. ` +
              `Enable them in Settings → Providers → Enable API Providers. ` +
              `Note: ${modelAlias} creates a separate metered API bill.`
            )
          }

          if (modelAlias === 'claude-api') {
            if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Settings → API Keys.')
            const client = new Anthropic({ apiKey: anthropicKey })
            const apiMessages = conversationMessages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
            const apiStream = await client.messages.create({
              model: API_MODEL_IDS['claude-api'],
              max_tokens: 4096,
              system: systemPrompt,
              messages: apiMessages,
              stream: true,
            })
            for await (const event of apiStream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                send({ text: event.delta.text })
              }
            }
          } else if (modelAlias === 'openai-api') {
            if (!openaiKey) throw new Error('OPENAI_API_KEY is not configured. Add it in Settings → API Keys.')
            const client = new OpenAI({ apiKey: openaiKey })
            const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
              ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
              ...conversationMessages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
            ]
            const apiStream = await client.chat.completions.create({
              model: API_MODEL_IDS['openai-api'],
              messages: openaiMessages,
              stream: true,
              max_tokens: 4096,
            })
            for await (const chunk of apiStream) {
              const text = chunk.choices[0]?.delta?.content
              if (text) send({ text })
            }
          } else if (modelAlias === 'gemini-api') {
            if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in Settings → API Keys.')
            const client = new GoogleGenAI({ apiKey: geminiKey })
            const contents = conversationMessages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            }))
            const apiStream = await client.models.generateContentStream({
              model: API_MODEL_IDS['gemini-api'],
              contents,
              config: { systemInstruction: systemPrompt },
            })
            for await (const chunk of apiStream) {
              const text = chunk.text
              if (text) send({ text })
            }
          }

          done()
          return
        }

        // ── Ollama (default provider, no API billing) ───────────────────
        const cfg = getOllamaConfig()

        // Override endpoint from client settings if explicitly set
        const effectiveChatUrl = body.ollamaEndpoint?.trim()
          ? body.ollamaEndpoint.trim().replace(/\/(api\/(chat|generate))?\/?$/, '') + '/api/chat'
          : cfg.chatUrl

        const ollamaModel = resolveOllamaModel(modelAlias)

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[BertOS] mode=${cfg.mode} provider=${cfg.providerName} model=${ollamaModel} endpoint=${new URL(effectiveChatUrl).origin}`)
        }

        if (cfg.requiresApiKey && !cfg.apiKey) {
          throw new Error(
            `Ollama Cloud mode is enabled, but OLLAMA_API_KEY is missing. ` +
            `Add it in Vercel Project Settings → Environment Variables → OLLAMA_API_KEY and redeploy.`
          )
        }

        const ollamaMessages = [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...conversationMessages.map(m => ({ role: m.role, content: m.content })),
        ]

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`

        const res = await fetch(effectiveChatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: ollamaModel,
            messages: ollamaMessages,
            stream: true,
          }),
        })

        if (!res.ok) {
          let detail = `HTTP ${res.status}`
          try {
            const errBody = await res.json() as { error?: string; message?: string }
            detail = errBody.error ?? errBody.message ?? detail
          } catch { /* body not JSON */ }

          if (res.status === 401 || res.status === 403) {
            throw new Error(
              `Ollama ${cfg.mode === 'cloud' ? 'Cloud' : 'Local'} auth failed (${res.status}). ` +
              (cfg.mode === 'cloud'
                ? 'Check OLLAMA_API_KEY in Vercel environment variables.'
                : 'Run: ollama signin')
            )
          }
          throw new Error(`Ollama ${cfg.mode === 'cloud' ? 'Cloud' : 'Local'}: ${detail}`)
        }

        if (!res.body) throw new Error('No response body from Ollama.')

        const reader  = res.body.getReader()
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
              const data = JSON.parse(line) as {
                message?: { content?: string }
                response?: string
                done?: boolean
              }
              const text = data.message?.content ?? data.response ?? ''
              if (text) send({ text })
            } catch { /* skip malformed NDJSON */ }
          }
        }

        done()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Stream error'
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch { /* controller already closed */ }
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
