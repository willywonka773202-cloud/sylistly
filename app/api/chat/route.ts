import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { routePrompt } from '@/lib/bertos/router'
import type { Message } from '@/lib/bertos/types'

export const runtime = 'edge'

// Lazy-init clients — only instantiate if the key is present so the route
// can still handle models that ARE configured even if others are not.
const getAnthropic = () =>
  process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null

const getOpenAI = () =>
  process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null

const getGoogle = () =>
  process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null

// Map BertOS model aliases → concrete model IDs
const MODEL_IDS: Record<string, string> = {
  claude: 'claude-opus-4-5',
  codex: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
}

type BertosModel = 'claude' | 'codex' | 'gemini'

function resolveModel(alias: string): BertosModel {
  if (alias === 'claude') return 'claude'
  if (alias === 'codex') return 'codex'
  if (alias === 'gemini') return 'gemini'
  // Handles concrete IDs returned by the router
  if (alias.startsWith('claude')) return 'claude'
  if (alias.startsWith('gpt') || alias.startsWith('o1') || alias.startsWith('o3')) return 'codex'
  if (alias.startsWith('gemini')) return 'gemini'
  return 'claude'
}

function messagesToPrompt(messages: Message[]): string {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    messages?: Message[]
    prompt?: string
    model: string
    systemPrompt?: string
  }

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

  // Resolve messages array / raw prompt
  const messages: Message[] = body.messages ?? [{
    id: '1',
    role: 'user',
    content: body.prompt ?? '',
    timestamp: Date.now(),
  }]

  const systemMessages = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')
  const systemPrompt = body.systemPrompt
    ?? systemMessages.map(m => m.content).join('\n')
    ?? 'You are BertOS, an advanced AI assistant. Be precise, thorough, and helpful.'

  // Resolve target model — handle 'auto' with local classifier (no external call needed)
  let modelAlias = body.model === 'auto'
    ? routePrompt(conversationMessages[conversationMessages.length - 1]?.content ?? '', 'auto').primary
    : body.model
  const target = resolveModel(modelAlias)

  // Emit router decision immediately so the UI can show it before first chunk
  const routerDecision = body.model === 'auto'
    ? routePrompt(conversationMessages[conversationMessages.length - 1]?.content ?? '', 'auto')
    : { primary: target, reasoning: `Routed to ${target} as selected.`, confidence: 1, taskType: 'general', strategy: 'single' }

  ;(async () => {
    try {
      await send({ routerDecision })

      if (target === 'claude') {
        const client = getAnthropic()
        if (!client) throw new Error('ANTHROPIC_API_KEY is not configured.')

        const apiMessages = conversationMessages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))

        const stream = await client.messages.create({
          model: MODEL_IDS.claude,
          max_tokens: 4096,
          system: systemPrompt,
          messages: apiMessages,
          stream: true,
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            await send({ text: event.delta.text })
          }
        }

      } else if (target === 'codex') {
        const client = getOpenAI()
        if (!client) throw new Error('OPENAI_API_KEY is not configured.')

        const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          ...conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ]

        const stream = await client.chat.completions.create({
          model: MODEL_IDS.codex,
          messages: openaiMessages,
          stream: true,
          max_tokens: 4096,
        })

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) await send({ text })
        }

      } else if (target === 'gemini') {
        const client = getGoogle()
        if (!client) throw new Error('GEMINI_API_KEY is not configured.')

        const contents = conversationMessages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }))

        const stream = await client.models.generateContentStream({
          model: MODEL_IDS.gemini,
          contents,
          config: { systemInstruction: systemPrompt },
        })

        for await (const chunk of stream) {
          const text = chunk.text
          if (text) await send({ text })
        }
      }

      await done()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Stream error'
      try {
        await send({ error: message })
        await done()
      } catch {
        // writer already closed
      }
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
