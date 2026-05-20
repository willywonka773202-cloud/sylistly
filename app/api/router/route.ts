import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { routePrompt } from '@/lib/bertos/router'

export const runtime = 'edge'

const SYSTEM = `You are an AI routing specialist for BertOS. Analyze the user's prompt and return ONLY a JSON object with:
- "reasoning": one sentence explaining why you chose this model
- "recommendedModel": exactly one of "ollama-pro", "claude-code", "codex-cli", "gemini-cli"
- "taskType": one of "coding", "writing", "research", "analysis", "math", "brainstorming", "debugging", "general"
- "confidence": number 0-1

Rules:
- Default is always "ollama-pro" (always-on subscription provider, no extra billing)
- Heavy coding / debugging / implementation → "codex-cli" (OpenAI Codex via CLI subscription)
- Long-form writing / reasoning / nuanced analysis → "claude-code" (Claude via CLI subscription)
- Research / large documents / web knowledge → "gemini-cli" (Gemini via CLI subscription)
- Math / general → "ollama-pro"`

const MODEL_TO_ALIAS: Record<string, string> = {
  'ollama-pro':  'ollama-pro',
  'claude-code': 'claude-code',
  'codex-cli':   'codex-cli',
  'gemini-cli':  'gemini-cli',
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string }

  // Try GPT-4o-mini as smart classifier (cheap, fast)
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

      const alias = MODEL_TO_ALIAS[raw.recommendedModel ?? ''] ?? 'ollama-pro'

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
          primary: 'ollama-pro',
          reasoning: 'OpenAI quota exceeded — routing to Ollama Pro (default subscription provider).',
          confidence: 0.9,
          taskType: 'general',
          strategy: 'single',
          recommendedModel: 'ollama-pro',
        })
      }
      // fall through to rule-based
    }
  }

  // Rule-based fallback (works with zero API keys)
  const decision = routePrompt(prompt, 'auto')
  return NextResponse.json(decision)
}
