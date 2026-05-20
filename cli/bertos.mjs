#!/usr/bin/env node
/**
 * BertOS CLI
 * Local control tool for the BertOS development environment.
 * Uses only Node.js built-ins + native fetch (Node 18+). No external deps.
 */

const DAEMON_URL  = 'http://localhost:3001'
const APP_URL     = 'http://localhost:3000'
const AGENT_SECRET = process.env.BERTOS_AGENT_SECRET || ''

// ── ANSI color helpers ────────────────────────────────────────────────────────

const green  = s => `\x1b[32m${s}\x1b[0m`
const red    = s => `\x1b[31m${s}\x1b[0m`
const yellow = s => `\x1b[33m${s}\x1b[0m`
const cyan   = s => `\x1b[36m${s}\x1b[0m`
const bold   = s => `\x1b[1m${s}\x1b[0m`

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts)
  return res.json()
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 3000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ── Tree printer ──────────────────────────────────────────────────────────────

function printTree(nodes, prefix = '') {
  for (let i = 0; i < nodes.length; i++) {
    const node    = nodes[i]
    const isLast  = i === nodes.length - 1
    const branch  = isLast ? '└── ' : '├── '
    const childPfx = isLast ? '    ' : '│   '

    if (node.type === 'dir') {
      console.log(prefix + branch + bold(cyan(node.name + '/')))
      if (node.children?.length) {
        printTree(node.children, prefix + childPfx)
      }
    } else {
      const sizeStr = node.size != null ? yellow(` (${formatBytes(node.size)})`) : ''
      console.log(prefix + branch + node.name + sizeStr)
    }
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdStatus() {
  console.log(bold('BertOS Daemon Status'))
  console.log('─'.repeat(40))

  let data
  try {
    const res = await fetchWithTimeout(`${DAEMON_URL}/health`, {}, 3000)
    data = await res.json()
  } catch {
    console.log(red('✗ Daemon not running') + ' (http://localhost:3001)')
    console.log(yellow('  Start with: node scripts/daemon.mjs'))
    return
  }

  console.log(green('✓ Daemon running'))
  console.log(`  Version : ${data.version}`)
  console.log(`  PID     : ${data.pid}`)
  console.log(`  Repo    : ${cyan(data.cwd)}`)
  console.log(`  Port    : ${DAEMON_URL}`)
}

async function cmdProviders() {
  console.log(bold('BertOS Provider Status'))
  console.log('─'.repeat(40))

  let data
  try {
    const res = await fetchWithTimeout(`${APP_URL}/api/health`, {}, 3000)
    data = await res.json()
  } catch {
    console.log(red('✗ Next.js app not running') + ' (http://localhost:3000)')
    console.log(yellow('  Start with: npm run dev'))
    return
  }

  for (const [key, val] of Object.entries(data)) {
    if (key === 'enableApiProviders') {
      console.log(`  API providers enabled : ${val ? green('yes') : yellow('no')}`)
    } else {
      const icon = val ? green('✓') : red('✗')
      console.log(`  ${icon} ${key}`)
    }
  }
}

async function cmdDoctor() {
  console.log(bold('BertOS Doctor'))
  console.log('─'.repeat(40))

  // Check daemon
  try {
    await fetchWithTimeout(`${DAEMON_URL}/health`, {}, 2000)
    console.log(green('✓') + ' Daemon running on port 3001')
  } catch {
    console.log(red('✗') + ' Daemon not running')
    console.log(yellow('    → Run: node scripts/daemon.mjs'))
  }

  // Check Next.js
  try {
    await fetchWithTimeout(`${APP_URL}/api/health`, {}, 2000)
    console.log(green('✓') + ' Next.js app running on port 3000')
  } catch {
    console.log(red('✗') + ' Next.js app not running')
    console.log(yellow('    → Run: npm run dev'))
  }

  // Check Ollama
  const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  try {
    await fetchWithTimeout(`${ollamaBase}/api/tags`, {}, 2000)
    console.log(green('✓') + ` Ollama reachable at ${ollamaBase}`)
  } catch {
    const ollamaKey = process.env.OLLAMA_API_KEY || ''
    if (ollamaKey) {
      console.log(yellow('~') + ' Ollama Local not running (cloud key configured)')
    } else {
      console.log(red('✗') + ` Ollama not reachable at ${ollamaBase}`)
      console.log(yellow('    → Run: ollama serve'))
    }
  }

  // Check agent secret
  if (AGENT_SECRET) {
    console.log(green('✓') + ' BERTOS_AGENT_SECRET is set')
  } else {
    console.log(yellow('~') + ' BERTOS_AGENT_SECRET not set (dev mode — auth disabled)')
  }

  // Check API keys
  const keys = [
    ['ANTHROPIC_API_KEY', 'Anthropic'],
    ['OPENAI_API_KEY', 'OpenAI'],
    ['GEMINI_API_KEY', 'Gemini'],
    ['OLLAMA_API_KEY', 'Ollama Cloud'],
  ]
  for (const [envVar, label] of keys) {
    if (process.env[envVar]) {
      console.log(green('✓') + ` ${label} key configured`)
    } else {
      console.log(yellow('~') + ` ${label} key not set (optional)`)
    }
  }
}

async function cmdAsk(message) {
  if (!message) {
    console.error(red('Error: provide a message, e.g.: bertos ask "Hello"'))
    process.exit(1)
  }

  const headers = {
    'Content-Type':    'application/json',
  }
  if (AGENT_SECRET) {
    headers['x-bertos-secret'] = AGENT_SECRET
  }

  let res
  try {
    res = await fetch(`${APP_URL}/api/agent/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
    })
  } catch (err) {
    console.error(red('Error: could not connect to Next.js app at ' + APP_URL))
    console.error(yellow('Start the app with: npm run dev'))
    process.exit(1)
  }

  if (res.status === 401) {
    console.error(red('Error: Unauthorized — check BERTOS_AGENT_SECRET'))
    process.exit(1)
  }
  if (!res.ok) {
    const text = await res.text()
    console.error(red(`Error: HTTP ${res.status} — ${text}`))
    process.exit(1)
  }

  const contentType = res.headers.get('content-type') || ''
  const decoder = new TextDecoder()
  let buffer = ''

  if (!res.body) {
    const text = await res.text()
    console.log(text)
    return
  }

  const reader = res.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      if (contentType.includes('text/event-stream')) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue
          try {
            const data = JSON.parse(payload)
            if (data.text) process.stdout.write(data.text)
            if (data.error) {
              process.stdout.write('\n')
              console.error(red('Error: ' + data.error))
            }
          } catch { /* skip malformed */ }
        }
      } else {
        // NDJSON fallback
        try {
          const data = JSON.parse(line)
          if (data.text) process.stdout.write(data.text)
        } catch { /* skip */ }
      }
    }
  }

  process.stdout.write('\n')
}

async function cmdFiles() {
  console.log(bold('Repository File Tree'))
  console.log('─'.repeat(40))

  let data
  try {
    data = await fetchJSON(`${DAEMON_URL}/repo/files`)
  } catch {
    console.error(red('Error: daemon not running at ' + DAEMON_URL))
    console.error(yellow('Start with: node scripts/daemon.mjs'))
    process.exit(1)
  }

  if (data.error) {
    console.error(red('Error: ' + data.error))
    process.exit(1)
  }

  printTree(data.tree || [])
}

async function cmdGit() {
  console.log(bold('Git Status'))
  console.log('─'.repeat(40))

  let data
  try {
    data = await fetchJSON(`${DAEMON_URL}/repo/status`)
  } catch {
    console.error(red('Error: daemon not running at ' + DAEMON_URL))
    console.error(yellow('Start with: node scripts/daemon.mjs'))
    process.exit(1)
  }

  if (data.error) {
    console.error(red('Error: ' + data.error))
    process.exit(1)
  }

  console.log(`  Branch   : ${green(data.branch)}`)
  console.log(`  Remote   : ${data.remote ? cyan(data.remote) : yellow('(none)')}`)
  console.log(`  Ahead    : ${data.ahead}`)
  console.log(`  Behind   : ${data.behind}`)

  if (data.staged?.length) {
    console.log(bold('\nStaged:'))
    for (const f of data.staged) console.log(`  ${green('+')} ${f}`)
  }
  if (data.modified?.length) {
    console.log(bold('\nModified:'))
    for (const f of data.modified) console.log(`  ${yellow('~')} ${f}`)
  }
  if (data.untracked?.length) {
    console.log(bold('\nUntracked:'))
    for (const f of data.untracked) console.log(`  ${red('?')} ${f}`)
  }

  if (!data.staged?.length && !data.modified?.length && !data.untracked?.length) {
    console.log(green('\n  Working tree clean'))
  }
}

async function cmdBuild() {
  console.log(bold('Running: npm run build'))
  console.log('─'.repeat(40))

  let res
  try {
    const url = `${DAEMON_URL}/repo/run?cmd=${encodeURIComponent('npm run build')}`
    res = await fetch(url)
  } catch {
    console.error(red('Error: daemon not running at ' + DAEMON_URL))
    console.error(yellow('Start with: node scripts/daemon.mjs'))
    process.exit(1)
  }

  if (!res.ok) {
    const data = await res.json()
    console.error(red('Error: ' + (data.error || `HTTP ${res.status}`)))
    process.exit(1)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let exitCode = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const data = JSON.parse(line)
        if (data.type === 'stdout') process.stdout.write(data.text)
        else if (data.type === 'stderr') process.stderr.write(yellow(data.text))
        else if (data.type === 'exit') {
          exitCode = data.code ?? 0
          if (exitCode === 0) {
            console.log(green('\n✓ Build succeeded'))
          } else {
            console.log(red(`\n✗ Build failed (exit code ${exitCode})`))
          }
        } else if (data.type === 'error') {
          console.error(red('Error: ' + data.text))
        }
      } catch { /* skip malformed */ }
    }
  }

  process.exit(exitCode)
}

// ── Usage ─────────────────────────────────────────────────────────────────────

function printUsage() {
  console.log(bold('BertOS CLI') + ' — local development tool\n')
  console.log('Usage:')
  console.log(`  ${cyan('bertos status')}        Check daemon status and repo info`)
  console.log(`  ${cyan('bertos providers')}     Show provider availability from the Next.js app`)
  console.log(`  ${cyan('bertos doctor')}        Run full environment health check`)
  console.log(`  ${cyan('bertos ask "<msg>"')}   Send a message to the BertOS agent`)
  console.log(`  ${cyan('bertos files')}         Print repository file tree`)
  console.log(`  ${cyan('bertos git')}           Show git status`)
  console.log(`  ${cyan('bertos build')}         Run npm run build (streamed output)`)
  console.log()
  console.log('Environment variables:')
  console.log(`  ${yellow('BERTOS_AGENT_SECRET')}   Secret for agent API auth`)
  console.log(`  ${yellow('BERTOS_DAEMON_PORT')}    Daemon port override (default: 3001)`)
}

// ── Entry point ───────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv

switch (command) {
  case 'status':
    await cmdStatus()
    break
  case 'providers':
    await cmdProviders()
    break
  case 'doctor':
    await cmdDoctor()
    break
  case 'ask':
    await cmdAsk(rest.join(' '))
    break
  case 'files':
    await cmdFiles()
    break
  case 'git':
    await cmdGit()
    break
  case 'build':
    await cmdBuild()
    break
  default:
    printUsage()
    break
}
