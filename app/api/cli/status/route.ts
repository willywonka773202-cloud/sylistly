import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { CLI_COMMANDS } from '@/lib/bertos/providers'

export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)

async function checkCLI(command: string): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execFileAsync(command, ['--version'], { timeout: 3000 })
    return { available: true, version: stdout.trim().split('\n')[0] }
  } catch {
    return { available: false }
  }
}

export async function GET() {
  const results = await Promise.allSettled([
    checkCLI(CLI_COMMANDS['claude-code'] ?? 'claude'),
    checkCLI(CLI_COMMANDS['gemini-cli']  ?? 'gemini'),
    checkCLI(CLI_COMMANDS['codex-cli']   ?? 'codex'),
  ])

  const [claude, gemini, codex] = results.map(r =>
    r.status === 'fulfilled' ? r.value : { available: false }
  )

  return NextResponse.json({
    'claude-code': claude,
    'gemini-cli':  gemini,
    'codex-cli':   codex,
  })
}
