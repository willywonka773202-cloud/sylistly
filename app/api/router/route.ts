import { NextRequest, NextResponse } from 'next/server'
import { routePrompt } from '@/lib/bertos/router'
import type { AIModel } from '@/lib/bertos/types'

export async function POST(req: NextRequest) {
  const { prompt, model } = await req.json() as { prompt: string; model: AIModel }
  const decision = routePrompt(prompt, model)
  return NextResponse.json(decision)
}
