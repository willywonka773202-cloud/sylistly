#!/usr/bin/env node
/**
 * BertOS Local Filesystem Bridge Daemon
 * Provides a local HTTP API for file system and git operations.
 * Runs on port 3001 by default (BERTOS_DAEMON_PORT env var overrides).
 */

import { createServer } from 'http'
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, existsSync } from 'fs'
import { join, resolve, extname, dirname } from 'path'
import { execSync, spawn } from 'child_process'

const PORT = parseInt(process.env.BERTOS_DAEMON_PORT || '3001', 10)
const REPO_ROOT = process.cwd()

// ── Safety ────────────────────────────────────────────────────────────────────

const BLOCKED_SEGMENTS = [
  'node_modules', '.git', '.next', 'dist', 'build', '.env', 'sylistly',
]

const IGNORE_NAMES = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.vercel',
  '.DS_Store',
])

const IGNORE_EXTENSIONS = new Set(['.lock'])

/**
 * Validate that a path is safe to access:
 * - must resolve inside REPO_ROOT
 * - must not contain blocked segments
 * - must not use path traversal
 */
function validatePath(relPath) {
  if (!relPath || typeof relPath !== 'string') {
    throw new Error('Path is required')
  }

  // Block path traversal attempts before resolving
  if (relPath.includes('../') || relPath.includes('..\\') || relPath === '..') {
    throw new Error('Path traversal not allowed')
  }

  // Block forbidden segments in the path
  const normalised = relPath.replace(/\\/g, '/')
  for (const seg of BLOCKED_SEGMENTS) {
    const parts = normalised.split('/')
    if (parts.some(p => p === seg || p.startsWith('.env'))) {
      throw new Error(`Access to '${seg}' is blocked`)
    }
  }

  const abs = resolve(REPO_ROOT, relPath)

  // Ensure the resolved path stays inside the repo root
  if (!abs.startsWith(REPO_ROOT + '/') && abs !== REPO_ROOT) {
    throw new Error('Path escapes repo root')
  }

  return abs
}

// ── Language detection ────────────────────────────────────────────────────────

function detectLanguage(filePath) {
  const ext = extname(filePath).toLowerCase()
  const map = {
    '.tsx':     'tsx',
    '.jsx':     'jsx',
    '.ts':      'typescript',
    '.js':      'javascript',
    '.mjs':     'javascript',
    '.cjs':     'javascript',
    '.py':      'python',
    '.md':      'markdown',
    '.mdx':     'markdown',
    '.json':    'json',
    '.yaml':    'yaml',
    '.yml':     'yaml',
    '.toml':    'toml',
    '.css':     'css',
    '.scss':    'scss',
    '.html':    'html',
    '.sh':      'bash',
    '.bash':    'bash',
    '.zsh':     'bash',
    '.env':     'dotenv',
    '.sql':     'sql',
    '.rs':      'rust',
    '.go':      'go',
    '.rb':      'ruby',
    '.java':    'java',
    '.c':       'c',
    '.cpp':     'cpp',
    '.h':       'c',
    '.hpp':     'cpp',
    '.graphql': 'graphql',
    '.gql':     'graphql',
    '.xml':     'xml',
    '.svg':     'svg',
    '.txt':     'text',
  }
  return map[ext] || 'text'
}

// ── Directory tree ────────────────────────────────────────────────────────────

function shouldIgnore(name) {
  if (IGNORE_NAMES.has(name)) return true
  const ext = extname(name)
  if (IGNORE_EXTENSIONS.has(ext)) return true
  if (name.endsWith('.lock') || name === 'package-lock.json' || name === 'yarn.lock' || name === 'pnpm-lock.yaml') return true
  return false
}

function buildTree(absPath, relBase, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return []

  let entries
  try {
    entries = readdirSync(absPath, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes = []
  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue

    const entryAbs = join(absPath, entry.name)
    const entryRel = join(relBase, entry.name).replace(/\\/g, '/')

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: entryRel,
        type: 'dir',
        children: buildTree(entryAbs, entryRel, depth + 1, maxDepth),
      })
    } else if (entry.isFile()) {
      let size = 0
      try {
        size = statSync(entryAbs).size
      } catch { /* ignore */ }

      nodes.push({
        name:     entry.name,
        path:     entryRel,
        type:     'file',
        language: detectLanguage(entry.name),
        size,
      })
    }
  }

  return nodes
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function gitExec(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return ''
  }
}

function getGitStatus() {
  const branch = gitExec('git rev-parse --abbrev-ref HEAD') || 'unknown'
  const remote = gitExec('git remote get-url origin') || ''

  const porcelain = gitExec('git status --porcelain')
  const modified  = []
  const untracked = []
  const staged    = []

  for (const line of porcelain.split('\n')) {
    if (!line.trim()) continue
    const xy   = line.slice(0, 2)
    const file = line.slice(3).trim()
    const x    = xy[0]
    const y    = xy[1]

    if (xy === '??') {
      untracked.push(file)
    } else {
      if (x !== ' ' && x !== '?') staged.push(file)
      if (y !== ' ' && y !== '?') modified.push(file)
    }
  }

  let ahead  = 0
  let behind = 0
  try {
    const upstream = gitExec(`git rev-parse --abbrev-ref ${branch}@{u}`)
    if (upstream) {
      const raw   = gitExec(`git rev-list --left-right --count ${branch}...${upstream}`)
      const parts = raw.split('\t')
      ahead  = parseInt(parts[0] || '0', 10) || 0
      behind = parseInt(parts[1] || '0', 10) || 0
    }
  } catch { /* no upstream */ }

  return { branch, remote, modified, untracked, staged, ahead, behind }
}

// ── Patch applier ─────────────────────────────────────────────────────────────

function applyPatch(originalContent, diff) {
  const origLines = originalContent.split('\n')
  const diffLines = diff.split('\n')
  const result = [...origLines]
  let offset = 0  // tracks how many lines have been added/removed so far
  let i = 0
  while (i < diffLines.length) {
    const line = diffLines[i]
    if (line.startsWith('@@ ')) {
      const m = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (!m) { i++; continue }
      const origStart = parseInt(m[1], 10) - 1  // 0-indexed
      let pos = origStart + offset
      i++
      while (i < diffLines.length && !diffLines[i].startsWith('@@ ') && !diffLines[i].startsWith('diff ')) {
        const dl = diffLines[i]
        if (dl.startsWith('-')) {
          result.splice(pos, 1)
          offset--
        } else if (dl.startsWith('+')) {
          result.splice(pos, 0, dl.slice(1))
          pos++
          offset++
        } else if (dl.startsWith(' ') || dl === '') {
          pos++
        } else if (dl.startsWith('\\')) {
          // no newline at end of file marker — skip
        }
        i++
      }
    } else {
      i++
    }
  }
  return result.join('\n')
}

// ── Allowed commands ──────────────────────────────────────────────────────────

const ALLOWED_COMMANDS = new Set([
  'npm run build',
  'npm run typecheck',
  'npm run lint',
  'npm test',
  'git status',
  'git --no-pager diff',
  'git --no-pager diff --staged',
  'git --no-pager log --oneline -5',
  'git --no-pager log --oneline -20',
  'git branch',
])

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonResponse(res, data, status = 200) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...CORS_HEADERS,
  })
  res.end(body)
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')) }
      catch { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

function getQuery(url) {
  const parsed = new URL(url, 'http://localhost')
  const params = {}
  for (const [k, v] of parsed.searchParams.entries()) {
    params[k] = v
  }
  return params
}

function getPathname(url) {
  return new URL(url, 'http://localhost').pathname
}

// ── Request handler ───────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  const pathname = getPathname(req.url)
  const query    = getQuery(req.url)
  const method   = req.method

  try {
    // ── GET /health ───────────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/health') {
      const repoRemote = gitExec('git remote get-url origin')
      const repoSafe = !repoRemote.toLowerCase().includes('sylistly')
      return jsonResponse(res, {
        status:  'ok',
        version: '1.0.0',
        cwd:     REPO_ROOT,
        pid:     process.pid,
        repoRemote,
        repoSafe,
      })
    }

    // ── GET /repo/files ───────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/repo/files') {
      const tree = buildTree(REPO_ROOT, '', 0, 6)
      return jsonResponse(res, { tree })
    }

    // ── GET /repo/file?path=<relpath> ─────────────────────────────────────────
    if (method === 'GET' && pathname === '/repo/file') {
      if (!query.path) {
        return jsonResponse(res, { error: 'path query param required' }, 400)
      }

      const abs = validatePath(query.path)

      if (!existsSync(abs)) {
        return jsonResponse(res, { error: 'File not found' }, 404)
      }

      const stat = statSync(abs)
      if (!stat.isFile()) {
        return jsonResponse(res, { error: 'Path is not a file' }, 400)
      }

      const content  = readFileSync(abs, 'utf8')
      const language = detectLanguage(query.path)

      return jsonResponse(res, { content, language, size: stat.size })
    }

    // ── POST /repo/file/write ─────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/repo/file/write') {
      const body = await parseBody(req)
      if (!body.path || typeof body.content !== 'string') {
        return jsonResponse(res, { error: 'path and content are required' }, 400)
      }

      const abs = validatePath(body.path)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, body.content, 'utf8')

      return jsonResponse(res, { ok: true })
    }

    // ── POST /repo/file/create ────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/repo/file/create') {
      const body = await parseBody(req)
      if (!body.path) {
        return jsonResponse(res, { error: 'path is required' }, 400)
      }

      const abs = validatePath(body.path)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, body.content ?? '', 'utf8')

      return jsonResponse(res, { ok: true })
    }

    // ── POST /repo/apply-patch ────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/repo/apply-patch') {
      const body = await parseBody(req)
      if (!body.diff || typeof body.diff !== 'string') {
        return jsonResponse(res, { error: 'diff is required' }, 400)
      }

      const diff = body.diff
      const diffLines = diff.split('\n')

      // Collect per-file diffs by splitting on `diff --git` or `--- a/` boundaries
      // We detect file boundaries by `--- a/path` lines
      const filePatches = []
      let currentFilePath = null
      let currentDiffLines = []

      for (let i = 0; i < diffLines.length; i++) {
        const line = diffLines[i]
        if (line.startsWith('--- ')) {
          // Save previous file patch if any
          if (currentFilePath !== null) {
            filePatches.push({ filePath: currentFilePath, diffText: currentDiffLines.join('\n') })
          }
          // Parse path from `--- a/path` or `--- path`
          const rawPath = line.slice(4).trim()
          currentFilePath = rawPath.startsWith('a/') ? rawPath.slice(2) : rawPath
          currentDiffLines = [line]
        } else if (currentFilePath !== null) {
          currentDiffLines.push(line)
        }
      }
      // Push last collected patch
      if (currentFilePath !== null) {
        filePatches.push({ filePath: currentFilePath, diffText: currentDiffLines.join('\n') })
      }

      if (filePatches.length === 0) {
        return jsonResponse(res, { error: 'No file patches found in diff' }, 400)
      }

      let totalLinesChanged = 0

      for (const { filePath, diffText } of filePatches) {
        // Validate path
        const abs = validatePath(filePath)

        // Read current content
        let originalContent = ''
        if (existsSync(abs)) {
          originalContent = readFileSync(abs, 'utf8')
        }

        // Count lines before
        const linesBefore = originalContent.split('\n').length

        // Apply the patch
        const patched = applyPatch(originalContent, diffText)

        // Count lines after
        const linesAfter = patched.split('\n').length
        totalLinesChanged += Math.abs(linesAfter - linesBefore)

        // Write result
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, patched, 'utf8')
      }

      const singleFile = filePatches.length === 1 ? filePatches[0].filePath : null
      return jsonResponse(res, {
        ok: true,
        file: singleFile,
        files: filePatches.map(p => p.filePath),
        linesChanged: totalLinesChanged,
      })
    }

    // ── GET /repo/status ──────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/repo/status') {
      const status = getGitStatus()
      return jsonResponse(res, status)
    }

    // ── GET /repo/diff?path=<relpath> ─────────────────────────────────────────
    if (method === 'GET' && pathname === '/repo/diff') {
      let diffCmd = 'git diff'
      if (query.path) {
        validatePath(query.path)
        diffCmd = `git diff -- ${JSON.stringify(query.path)}`
      }
      const diff = gitExec(diffCmd)
      return jsonResponse(res, { diff })
    }

    // ── GET /repo/diff/staged ─────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/repo/diff/staged') {
      const diff = gitExec('git diff --staged')
      return jsonResponse(res, { diff })
    }

    // ── POST /repo/git/commit ─────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/repo/git/commit') {
      const body = await parseBody(req)
      if (!body.message || typeof body.message !== 'string') {
        return jsonResponse(res, { error: 'message is required' }, 400)
      }

      // Check if there is anything to commit
      const porcelain = gitExec('git status --porcelain')
      if (!porcelain.trim()) {
        return jsonResponse(res, { error: 'Nothing to commit — working tree is clean' }, 400)
      }

      // Stage all tracked changes
      execSync('git add -u', { cwd: REPO_ROOT, stdio: 'pipe' })

      // Commit — NEVER auto-push
      const safeMessage = body.message.replace(/'/g, "'\\''")
      execSync(`git commit -m '${safeMessage}'`, { cwd: REPO_ROOT, stdio: 'pipe' })

      const hash = gitExec('git rev-parse --short HEAD')
      return jsonResponse(res, { ok: true, hash })
    }

    // ── GET /repo/run?cmd=<command> ───────────────────────────────────────────
    if (method === 'GET' && pathname === '/repo/run') {
      const cmd = query.cmd
      if (!cmd) {
        return jsonResponse(res, { error: 'cmd query param required' }, 400)
      }

      if (!ALLOWED_COMMANDS.has(cmd)) {
        return jsonResponse(res, { error: 'Command not allowed' }, 403)
      }

      // Stream NDJSON output
      res.writeHead(200, {
        'Content-Type':      'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control':     'no-cache',
        ...CORS_HEADERS,
      })

      const [bin, ...args] = cmd.split(' ')
      // Disable any interactive pager (git diff / git log would otherwise
      // spawn `less` and block forever waiting for keyboard input).
      const childEnv = {
        ...process.env,
        GIT_PAGER: 'cat',
        PAGER: 'cat',
        GIT_TERMINAL_PROMPT: '0',
        NO_COLOR: '1',
      }
      const child = spawn(bin, args, { cwd: REPO_ROOT, shell: true, env: childEnv })

      const sendLine = (type, text) => {
        try {
          res.write(JSON.stringify({ type, text }) + '\n')
        } catch { /* stream closed */ }
      }

      const finish = (code) => {
        try {
          res.write(JSON.stringify({ type: 'exit', code }) + '\n')
          res.end()
        } catch { /* stream closed */ }
      }

      // Safety: kill child and close response after 60 seconds
      const timeout = setTimeout(() => {
        try { child.kill() } catch { /* already dead */ }
        sendLine('error', 'Command timed out after 60 seconds')
        finish(124)
      }, 60_000)

      child.stdout.on('data', data => sendLine('stdout', data.toString()))
      child.stderr.on('data', data => sendLine('stderr', data.toString()))

      child.on('close', code => {
        clearTimeout(timeout)
        finish(code ?? 0)
      })

      child.on('error', err => {
        clearTimeout(timeout)
        try {
          res.write(JSON.stringify({ type: 'error', text: err.message }) + '\n')
          res.end()
        } catch { /* stream closed */ }
      })

      return // response handled by child process events
    }

    // ── 404 ───────────────────────────────────────────────────────────────────
    return jsonResponse(res, { error: 'Not found' }, 404)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse(res, { error: message }, 500)
  }
}

// ── Start server ──────────────────────────────────────────────────────────────

const server = createServer(handleRequest)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[BertOS Daemon] Running on port ${PORT}`)
  console.log(`[BertOS Daemon] Repo root: ${REPO_ROOT}`)
  console.log(`[BertOS Daemon] Safe mode: ON — blocks paths outside repo`)

  // Repo safety check
  const repoRemote = gitExec('git remote get-url origin')
  console.log(`[BertOS Daemon] Repo remote: ${repoRemote || '(none)'}`)
  if (repoRemote.toLowerCase().includes('sylistly')) {
    console.log('[BertOS Daemon] WARNING: Repo remote appears to be sylistly! Safety rules are still enforced.')
  }
})

server.on('error', err => {
  console.error('[BertOS Daemon] Server error:', err.message)
  process.exit(1)
})
