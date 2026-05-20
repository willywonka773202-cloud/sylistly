import { NextResponse } from 'next/server'

// Node.js runtime required — makes outbound fetch to Hermes agent
export const runtime = 'nodejs'

// ── GET /api/hermes/status ────────────────────────────────────────────────────
//
// Checks whether the Hermes agent is reachable.
// Reads HERMES_API_URL and HERMES_API_KEY from environment.

export async function GET() {
  const hermesUrl = process.env.HERMES_API_URL?.trim()
  const hermesKey = process.env.HERMES_API_KEY?.trim() || ''

  if (!hermesUrl) {
    return NextResponse.json(
      { online: false, error: 'HERMES_API_URL not configured' },
      { status: 200 }
    )
  }

  const healthUrl = hermesUrl.replace(/\/$/, '') + '/health'

  try {
    const headers: Record<string, string> = {}
    if (hermesKey) headers['Authorization'] = `Bearer ${hermesKey}`

    const res = await fetch(healthUrl, {
      headers,
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({
        online: false,
        url:    hermesUrl,
        error:  `Hermes responded with HTTP ${res.status}`,
      })
    }

    // Try to parse version from response body if available
    let version: string | undefined
    try {
      const body = await res.json() as { version?: string }
      version = body.version
    } catch { /* response body not JSON or no version field */ }

    return NextResponse.json({
      online: true,
      url:    hermesUrl,
      ...(version ? { version } : {}),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      online: false,
      url:    hermesUrl,
      error:  message,
    })
  }
}
