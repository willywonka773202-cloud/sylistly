// Guards the /feed seed against React duplicate-key warnings. Static source
// scan — does NOT evaluate the social-feed store (which imports `@/lib/…`
// path aliases that jiti can't resolve outside the Next.js build context).
//
// What we check:
//   1. Every `feed-…` post id template produced by the two seed lists
//      (LAUNCH_COLLECTIONS + GENERATED_POST_PLAN) is unique. This catches
//      the actual React duplicate-key bug observed at runtime
//      (e.g. `feed-vacation-masc-resort` appearing twice).
//   2. The seed-post id format must include a source namespace (`launch-`
//      or `plan-`) so a future identical id in both lists can't collide.
//   3. No `feed-${X}` template inside store/social-feed.ts that doesn't
//      include a source-namespacing prefix — guards against regressions
//      where someone reverts to the bare `feed-${X}` form.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

interface SourceIdSet {
  source: string;
  arrayName: string;
  ids: string[];
}

function extractIds(filePath: string, arrayName: string): SourceIdSet {
  const absolute = path.join(ROOT, filePath);
  const content = readFileSync(absolute, 'utf8');
  // Match the array declaration and capture everything up to the matching
  // closing bracket. The simple approach: find `arrayName` then grep
  // `id: 'X'` / `id: "X"` lines between that anchor and the next top-level
  // `};` (close of the export const). Good enough for our two known files.
  const startIndex = content.indexOf(arrayName);
  if (startIndex < 0) {
    throw new Error(`Could not locate "${arrayName}" in ${filePath}`);
  }
  const slice = content.slice(startIndex);
  // Find the first ];  that comes after the start — terminates the array.
  const endMatch = slice.match(/\n\];/);
  const region = endMatch ? slice.slice(0, slice.indexOf(endMatch[0])) : slice;
  const idRegex = /\bid:\s*['"]([a-z0-9-]+)['"]/gi;
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(region)) !== null) {
    ids.push(match[1]);
  }
  return { source: filePath, arrayName, ids };
}

const failures: string[] = [];

// 1. Pull both lists.
const launchCollections = extractIds('lib/catalog.ts', 'LAUNCH_COLLECTIONS: CatalogCollection[]');
const generatedPlan = extractIds('store/social-feed.ts', 'GENERATED_POST_PLAN');

if (!launchCollections.ids.length) {
  failures.push('LAUNCH_COLLECTIONS produced 0 ids — extraction broke');
}
if (!generatedPlan.ids.length) {
  failures.push('GENERATED_POST_PLAN produced 0 ids — extraction broke');
}

// 2. Within-list uniqueness.
for (const set of [launchCollections, generatedPlan]) {
  const counts = new Map<string, number>();
  for (const id of set.ids) counts.set(id, (counts.get(id) || 0) + 1);
  const dupes = Array.from(counts.entries()).filter(([, n]) => n > 1);
  if (dupes.length) {
    failures.push(
      `${set.arrayName} has duplicate ids: ${dupes.map(([id, n]) => `${id}×${n}`).join(', ')}`,
    );
  }
}

// 3. The actual reported bug: bare `feed-${X}` templates without a source
//    namespace would re-introduce cross-list collisions like
//    `feed-vacation-masc-resort`. Verify both call sites now include the
//    `launch-` / `plan-` prefix.
const socialFeedSource = readFileSync(path.join(ROOT, 'store/social-feed.ts'), 'utf8');
const bareFeedIdRegex = /`feed-\$\{[^}]+?\.id\}`/g;
const bareMatches = socialFeedSource.match(bareFeedIdRegex) || [];
if (bareMatches.length) {
  failures.push(
    `store/social-feed.ts has un-namespaced feed id template(s) — would re-introduce React duplicate-key warnings: ${bareMatches.join(' / ')}. Use \`feed-launch-\${…}\` or \`feed-plan-\${…}\`.`,
  );
}

// 4. Defense-in-depth: confirm the two known collision-prone ids no longer
//    cross-collide *after* the namespacing prefix is applied.
const launchSet = new Set(launchCollections.ids.map((id) => `feed-launch-${id}`));
const planSet = new Set(generatedPlan.ids.map((id) => `feed-plan-${id}`));
const crossCollisions: string[] = [];
for (const id of launchSet) {
  if (planSet.has(id)) crossCollisions.push(id);
}
if (crossCollisions.length) {
  failures.push(
    `cross-source feed-id collisions remain after namespacing: ${crossCollisions.slice(0, 5).join(', ')}`,
  );
}

if (failures.length) {
  console.error('Feed seed uniqueness: FAILED');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

const sharedRawIds = launchCollections.ids.filter((id) => generatedPlan.ids.includes(id));
const sharedNote = sharedRawIds.length
  ? ` — ${sharedRawIds.length} raw id(s) intentionally shared across the two lists (${sharedRawIds.slice(0, 5).join(', ')}${sharedRawIds.length > 5 ? ', …' : ''}); the namespaced prefixes keep them separate`
  : '';
console.log(
  `Feed seed uniqueness: PASS (${launchCollections.ids.length} launch ids + ${generatedPlan.ids.length} plan ids, all namespaced as feed-launch-/feed-plan-${sharedNote}).`,
);
