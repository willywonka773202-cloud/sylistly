import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  return NextResponse.json({
    claude: !!process.env.ANTHROPIC_API_KEY,
    codex:  !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  })
}
