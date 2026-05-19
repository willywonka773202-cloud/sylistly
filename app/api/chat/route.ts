import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { routePrompt } from '@/lib/bertos/router'
import type { Message } from '@/lib/bertos/types'
import {
  resolveOllamaModel,
  resolveOllamaBase,
  CLI_MODEL_ALIASES,
  API_MODEL_ALIASES,
} from '@/lib/bertos/providers'

export const runtime = 'edge'

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
  const body = await req.json() as {
    messages?: Message[]
    prompt?: string
    model: string
    systemPrompt?: string
    clientKeys?: ClientKeys
    ollamaEndpoint?: string
    enableApiProviders?: boolean
  }

  const ck = body.clientKeys ?? {}
  const anthropicKey = resolveKey(process.env.ANTHROPIC_API_KEY, ck.anthropic)
  const openaiKey    = resolveKey(process.env.OPENAI_API_KEY,    ck.openai)
  const geminiKey    = resolveKey(process.env.GEMINI_API_KEY,    ck.google)

  const encoder = new TextEncoder()
  const ts = new TransformStream<Uint8Array, Uint8Array>()
  const writer = ts.writable.getWriter()

  const send = async (data: Record<string, unknown>) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
  }
  const done = async () => {
    await writer.write(encoder.encode('data: [DONE]\n\n'))
    await writer.close()
  }

  const messages: Message[] = body.messages ?? [{
    id: '1',
    role: 'user',
    content: body.prompt ?? '',
    timestamp: Date.now(),
  }]

  const systemMessages       = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')
  const systemPrompt = body.systemPrompt
    ?? systemMessages.map(m => m.content).join('\n')
    ?? 'You are BertOS, an advanced AI assistant. Be precise, thorough, and helpful.'

  const modelAlias = body.model === 'auto'
    ? routePrompt(conversationMessages[conversationMessages.length - 1]?.content ?? '', 'auto').primary
    : body.model

  const routerDecision = body.model === 'auto'
    ? routePrompt(conversationMessages[conversationMessages.length - 1]?.content ?? '', 'auto')
    : { primary: modelAlias, reasoning: `Routed to ${modelAlias} as selected.`, confidence: 1, taskType: 'general', strategy: 'single' }

  ;(async () => {
    try {
      await send({ routerDecision })

      // ── CLI subscription providers (require local process spawning) ──────────
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
          `${cliLabels[modelAlias] ?? modelAlias} requires local CLI process spawning — ` +
          `not yet available in the web interface. ` +
          `Run BertOS locally and install the CLI: ${installHints[modelAlias] ?? ''}`
        )
      }

      // ── Optional API providers (disabled by default) ─────────────────────────
      if (API_MODEL_ALIASES.has(modelAlias)) {
        const enableApi = body.enableApiProviders ?? (process.env.ENABLE_API_PROVIDERS === 'true')
        if (!enableApi) {
          throw new Error(
            `API providers are disabled by default. ` +
            `Enable them in Settings → Providers → Enable API Providers. ` +
            `Note: ${modelAlias} creates a separate metered API bill and is NOT included in any subscription.`
          )
        }

        if (modelAlias === 'claude-api') {
          if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Settings → API Keys.')
          const client = new Anthropic({ apiKey: anthropicKey })
          const apiMessages = conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
          const stream = await client.messages.create({
            model: API_MODEL_IDS['claude-api'],
            max_tokens: 4096,
            system: systemPrompt,
            messages: apiMessages,
            stream: true,
          })
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              await send({ text: event.delta.text })
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
          const stream = await client.chat.completions.create({
            model: API_MODEL_IDS['openai-api'],
            messages: openaiMessages,
            stream: true,
            max_tokens: 4096,
          })
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content
            if (text) await send({ text })
          }

        } else if (modelAlias === 'gemini-api') {
          if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in Settings → API Keys.')
          const client = new GoogleGenAI({ apiKey: geminiKey })
          const contents = conversationMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          }))
          const stream = await client.models.generateContentStream({
            model: API_MODEL_IDS['gemini-api'],
            contents,
            config: { systemInstruction: systemPrompt },
          })
          for await (const chunk of stream) {
            const text = chunk.text
            if (text) await send({ text })
          }
        }

      } else {
        // ── Ollama (default subscription provider, no API billing) ─────────────
        // Defaults to http://127.0.0.1:11434 — override in Settings → Ollama Endpoint
        const baseUrl = resolveOllamaBase(body.ollamaEndpoint)
        const ollamaModel = resolveOllamaModel(modelAlias)
        const generateUrl = baseUrl.replace(/\/(api\/(generate|chat))?\/?$/, '') + '/api/generate'

        const prompt = conversationMessages
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n\n') + '\n\nAssistant:'

        const res = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // No Authorization header — private Ollama instances do not require auth
          body: JSON.stringify({
            model: ollamaModel,
            system: systemPrompt || undefined,
            prompt,
            stream: true,
          }),
        })

        if (!res.ok) {
          let detail = `HTTP ${res.status}`
          try {
            const errBody = await res.json() as { error?: string }
            if (errBody.error) detail = errBody.error
          } catch { /* body not JSON */ }
          throw new Error(`Ollama: ${detail}`)
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
              const data = JSON.parse(line) as { response?: string; done?: boolean }
              if (data.response) await send({ text: data.response })
            } catch { /* skip malformed NDJSON */ }
          }
        }
      }

      await done()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Stream error'
      try {
        await send({ error: message })
        await done()
      } catch { /* writer already closed */ }
    }
  })()

  return new NextResponse(ts.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
