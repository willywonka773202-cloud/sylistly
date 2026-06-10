/**
 * Nightly bake-and-ship orchestrator (launchd runs this at 02:45):
 *   1) boots a local dev server (reads .env.local for the Anthropic key)
 *   2) runs scripts/bake-ai-looks.mjs against it (hard dollar cap inside)
 *   3) commits + pushes data/ai-look-library.json if it grew
 *   4) deploys to production (Vercel builds remotely; a failed deploy
 *      leaves the previous deployment serving — fail-safe)
 */
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 3939;
const BASE = `http://localhost:${PORT}`;

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: 'pipe' }).toString().trim();
}

async function waitForServer(timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/look`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vibe: 'clean', frame: 'androgynous', fast: true }),
      });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return false;
}

async function main() {
  console.log(`[${new Date().toISOString()}] bake-and-ship starting`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });

  try {
    if (!(await waitForServer())) throw new Error('dev server never became ready');
    execSync(`node scripts/bake-ai-looks.mjs ${BASE}`, { cwd: ROOT, stdio: 'inherit' });
  } finally {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }

  const diff = sh('git status --porcelain data/ai-look-library.json');
  if (!diff) {
    console.log('no new AI looks — nothing to ship');
    return;
  }
  sh('git add data/ai-look-library.json');
  execSync('git commit -m "Nightly AI bake: fresh Claude-composed looks" -m "Automated by scripts/bake-ai-ship.mjs"', {
    cwd: ROOT,
    stdio: 'inherit',
  });
  execSync('git push', { cwd: ROOT, stdio: 'inherit' });
  execSync('npx vercel --prod --yes', { cwd: ROOT, stdio: 'inherit' });
  console.log(`[${new Date().toISOString()}] bake-and-ship done`);
}

main().catch((error) => {
  console.error('bake-and-ship failed:', error.message);
  process.exit(1);
});
