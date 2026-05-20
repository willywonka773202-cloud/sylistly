import { NextRequest, NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  const cfg = getOllamaConfig()

  if (cfg.mode === 'cloud') {
    return NextResponse.json({
      models: [{ name: cfg.defaultModel, type: 'cloud', recommended: true }],
      mode: 'cloud',
    })
  }

  try {
    const res = await fetch(cfg.tagsUrl!, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      return NextResponse.json({ models: [], mode: 'local', error: `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { models?: Array<{ name: string; size?: number; modified_at?: string }> }
    return NextResponse.json({ models: data.models ?? [], mode: 'local' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ models: [], mode: 'local', error: message }, { status: 503 })
  }
}
