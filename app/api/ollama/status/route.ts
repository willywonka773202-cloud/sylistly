import { NextRequest, NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const cfg = getOllamaConfig()
  const testCloud = req.nextUrl.searchParams.get('testCloud') === 'true'

  if (cfg.mode === 'cloud') {
    // In cloud mode, we cannot ping tagsUrl (it's null).
    // Base availability on API key presence.
    const online = Boolean(cfg.apiKey)

    let testResult: { success: boolean; error?: string } | undefined

    if (testCloud && cfg.apiKey) {
      try {
        const res = await fetch(cfg.chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.defaultModel,
            messages: [{ role: 'user', content: 'Reply with only the word OK' }],
            stream: false,
          }),
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          testResult = { success: true }
        } else {
          const body = await res.text()
          testResult = { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
        }
      } catch (err) {
        testResult = { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }

    return NextResponse.json({
      online,
      mode: 'cloud',
      provider: 'Ollama Cloud',
      baseUrl: cfg.baseUrl,
      chatUrl: cfg.chatUrl,
      defaultModel: cfg.defaultModel,
      models: [{ name: cfg.defaultModel, type: 'cloud', recommended: true }],
      error: !online ? 'OLLAMA_API_KEY is missing. Add it in Vercel Project Settings → Environment Variables.' : undefined,
      testResult,
    })
  }

  // Local mode: try to reach the local Ollama instance
  const tagsUrl = cfg.tagsUrl!
  try {
    const res = await fetch(tagsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      return NextResponse.json({
        online: false,
        mode: 'local',
        provider: 'Ollama Local',
        baseUrl: cfg.baseUrl,
        chatUrl: cfg.chatUrl,
        defaultModel: cfg.defaultModel,
        models: [],
        error: `Ollama returned HTTP ${res.status}. Is Ollama running?`,
      })
    }

    const data = await res.json() as { models?: Array<{ name: string; size?: number }> }
    return NextResponse.json({
      online: true,
      mode: 'local',
      provider: 'Ollama Local',
      baseUrl: cfg.baseUrl,
      chatUrl: cfg.chatUrl,
      defaultModel: cfg.defaultModel,
      models: data.models ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({
      online: false,
      mode: 'local',
      provider: 'Ollama Local',
      baseUrl: cfg.baseUrl,
      chatUrl: cfg.chatUrl,
      defaultModel: cfg.defaultModel,
      models: [],
      error: `Local Ollama is offline: ${message}. Run: ollama serve`,
    })
  }
}
