import { NextRequest, NextResponse } from 'next/server'
import { resolveOllamaBase } from '@/lib/bertos/providers'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get('endpoint') ?? undefined
  const baseUrl = resolveOllamaBase(endpoint)
  const tagsUrl = baseUrl.replace(/\/(api\/(generate|chat|tags))?\/?$/, '') + '/api/tags'

  try {
    const res = await fetch(tagsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      return NextResponse.json({ models: [], error: `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json() as { models?: Array<{ name: string; size?: number; modified_at?: string }> }
    return NextResponse.json({ models: data.models ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json({ models: [], error: message }, { status: 503 })
  }
}
