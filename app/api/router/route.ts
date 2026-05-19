import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { routePrompt } from '@/lib/bertos/router'

export const runtime = 'edge'

const SYSTEM = `You are an AI routing specialist. Analyze the user's prompt and return ONLY a JSON object with:
- "reasoning": one sentence explaining why you chose this model
- "recommendedModel": exactly one of "claude-opus-4-5", "gpt-4o", "gemini-2.0-flash"
- "taskType": one of "coding", "writing", "research", "analysis", "math", "brainstorming", "debugging", "general"
- "confidence": number 0-1

Rules:
- coding / debugging / technical implementation → "gpt-4o"
- long research / massive documents / web knowledge → "gemini-2.0-flash"
- writing / reasoning / analysis / math / nuanced thinking → "claude-opus-4-5"
- default → "claude-opus-4-5"`

const MODEL_TO_ALIAS: Record<string, string> = {
  'claude-opus-4-5': 'claude',
  'claude-3-5-sonnet-latest': 'claude',
  'gpt-4o': 'codex',
  'gpt-4': 'codex',
  'gemini-2.0-flash': 'gemini',
  'gemini-1.5-pro': 'gemini',
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string }

  // Try GPT-4o-mini first (cheap, fast classifier)
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0,
      })

      const raw = JSON.parse(res.choices[0].message.content ?? '{}') as {
        reasoning?: string
        recommendedModel?: string
        taskType?: string
        confidence?: number
      }

      const alias = MODEL_TO_ALIAS[raw.recommendedModel ?? ''] ?? 'claude'

      return NextResponse.json({
        primary: alias,
        reasoning: raw.reasoning ?? 'Routed by AI classifier.',
        confidence: raw.confidence ?? 0.85,
        taskType: raw.taskType ?? 'general',
        strategy: 'single',
        recommendedModel: raw.recommendedModel,
      })
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
      const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('billing') || msg.includes('rate limit')
      if (isQuota) {
        return NextResponse.json({
          primary: 'llama3.2',
          reasoning: 'OpenAI unavailable — quota exceeded. Defaulting to Llama 3.2 via Ollama Cloud.',
          confidence: 0.9,
          taskType: 'general',
          strategy: 'single',
          recommendedModel: 'llama3.2',
        })
      }
      // fall through to rule-based
    }
  }

  // Rule-based fallback (works with zero API keys)
  const decision = routePrompt(prompt, 'auto')
  return NextResponse.json(decision)
}
