import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ConnectedAccount {
  appName?: string
  [key: string]: unknown
}

interface ComposioResponse {
  items?: ConnectedAccount[]
  [key: string]: unknown
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const queryKey = searchParams.get('key') ?? ''
  const key = (process.env.COMPOSIO_API_KEY ?? '').trim() || queryKey.trim()

  if (!key) {
    return NextResponse.json({ connected: false, error: 'COMPOSIO_API_KEY not set' })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch('https://backend.composio.dev/api/v1/connectedAccounts', {
      method: 'GET',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ connected: false, error: 'Invalid API key' })
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`)
      return NextResponse.json({ connected: false, error: errText })
    }

    const data = await res.json() as ComposioResponse
    const apps: string[] = data.items?.map((i) => i.appName ?? 'unknown').filter(Boolean) ?? []

    return NextResponse.json({ connected: true, apps })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ connected: false, error: message })
  }
}
