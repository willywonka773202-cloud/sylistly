/**
 * Auto-expand AND ship — the full local automation in one command.
 *
 *   1. node scripts/auto-expand.mjs   (grow catalog if SEARCHAPI_KEY set; regen outfit library)
 *   2. verify: tsc + production build  (never ship a red build)
 *   3. if data changed: commit + `vercel --prod`  (matches the current local deploy flow)
 *
 * Designed to be run on a schedule (launchd / cron) — see AUTOMATION.md.
 * Safe by construction: quality gates filter new products, and the build gate
 * blocks broken deploys. A run with no catalog change is a no-op.
 *
 * Run:  npm run auto:ship
 */
import { execSync } from 'node:child_process';

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const DATA_FILES = [
  'data/client-catalog.json',
  'data/outfit-library.json',
  'data/generated-catalog.json',
  'data/photo-catalog.json',
];

// 1) Grow + regenerate
sh('node scripts/auto-expand.mjs');

// 2) Anything to ship?
const dirty = out(`git status --porcelain ${DATA_FILES.join(' ')}`);
if (!dirty) {
  console.log('\nNo catalog/outfit changes this run — nothing to ship. ✅');
  process.exit(0);
}

console.log('\nChanges detected → verifying before deploy…');
sh('npx tsc --noEmit');
sh('npm run build');

// 3) Commit + deploy
sh(`git add ${DATA_FILES.join(' ')}`);
sh('git commit -m "auto-expand: refresh catalog + outfit library"');
console.log('\nVerified green → deploying to production…');
sh('npx vercel --prod --yes');
console.log('\n✅ auto-expand shipped to production.');
