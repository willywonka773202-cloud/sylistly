import { NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'

export const runtime = 'nodejs'

export async function GET() {
  const cfg = getOllamaConfig()
  return NextResponse.json({
    mode: cfg.mode,
    provider: cfg.providerName,
    chatUrl: cfg.chatUrl,
    defaultModel: cfg.defaultModel,
  })
}
