import { NextRequest, NextResponse } from 'next/server'
import { CLI_COMMANDS } from '@/lib/bertos/providers'

export const runtime = 'nodejs'

// CLI chat via subscription provider (e.g. Claude Code, Gemini CLI, Codex CLI)
// Full implementation requires spawning a local child process — stub for now.
export async function POST(req: NextRequest) {
  const body = await req.json() as { model: string; prompt: string }
  const command = CLI_COMMANDS[body.model as keyof typeof CLI_COMMANDS]

  if (!command) {
    return NextResponse.json({ error: `Unknown CLI model: ${body.model}` }, { status: 400 })
  }

  // TODO: spawn `command` as a child process, pipe stdin/stdout as SSE stream
  return NextResponse.json(
    {
      error:
        `CLI streaming for ${body.model} (${command}) is not yet implemented. ` +
        `Run BertOS locally and ensure ${command} is installed and authenticated.`,
    },
    { status: 501 }
  )
}
