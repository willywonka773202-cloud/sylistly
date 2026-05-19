import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const routeFiles = [
  'app/page.tsx',
  'app/feed/page.tsx',
  'app/build/page.tsx',
  'app/saved/page.tsx',
  'app/wardrobe/page.tsx',
  'app/profile/page.tsx',
  'app/discover/page.tsx',
  'app/canvas/page.tsx',
  'app/catalog-lab/page.tsx',
  'app/stylist/page.tsx',
  'app/checkout/page.tsx',
];

const requiredText: Array<{ file: string; text: string; label: string }> = [
  { file: 'components/BottomNav.tsx', text: "href: '/'", label: 'BottomNav links Home tab' },
  { file: 'components/BottomNav.tsx', text: "href: '/feed'", label: 'BottomNav links Feed tab' },
  { file: 'components/BottomNav.tsx', text: 'Open create menu', label: 'BottomNav has obvious center Create action' },
  { file: 'components/BottomNav.tsx', text: "href: '/stylist'", label: 'BottomNav links Syli as normal tab' },
  { file: 'components/BottomNav.tsx', text: "href: '/profile'", label: 'BottomNav links Profile tab' },
  { file: 'components/BottomNav.tsx', text: "router.push('/build')", label: 'Create sheet links Builder' },
  { file: 'components/BottomNav.tsx', text: "router.push('/wardrobe')", label: 'Create sheet links Wardrobe' },
  { file: 'components/BottomNav.tsx', text: "router.push('/stylist')", label: 'Create sheet links Syli' },
  { file: 'components/BottomNav.tsx', text: "router.push('/canvas')", label: 'BottomNav links Canvas' },
  { file: 'components/BottomNav.tsx', text: "router.push('/saved')", label: 'BottomNav can save current fit' },
  { file: 'app/page.tsx', text: 'href="/saved"', label: 'Saved remains reachable from Home' },
  { file: 'app/page.tsx', text: 'Your AI stylist is ready', label: 'Home has fashion OS hero' },
  { file: 'app/page.tsx', text: 'Search coming later', label: 'Home Search is clearly future-disabled' },
  { file: 'app/page.tsx', text: 'Notifications coming later', label: 'Home Notifications are clearly future-disabled' },
  { file: 'app/page.tsx', text: 'Pro coming later', label: 'Home Pro is clearly future-disabled' },
  { file: 'app/stylist/page.tsx', text: 'No backend AI is called here', label: 'Stylist is honest local beta' },
  { file: 'app/stylist/page.tsx', text: 'Responses are rule-based', label: 'Stylist response model is local and explicit' },
  { file: 'app/canvas/page.tsx', text: 'AI try-on needs a real backend', label: 'Try-On backend requirement is explicit' },
  { file: 'app/canvas/page.tsx', text: 'Generate image disabled', label: 'Try-On is clearly disabled' },
  { file: 'app/discover/page.tsx', text: 'Budget finds', label: 'Discover budget rail exists' },
  { file: 'app/discover/page.tsx', text: 'Premium picks', label: 'Discover premium rail exists' },
  { file: 'app/discover/page.tsx', text: 'Underused gems', label: 'Discover underused rail exists' },
  { file: 'app/wardrobe/page.tsx', text: 'Closet manager', label: 'Wardrobe insights exist' },
  { file: 'app/wardrobe/page.tsx', text: 'Future: local trip checklists from real closet items', label: 'Wardrobe packing is honestly future-disabled' },
  { file: 'app/wardrobe/page.tsx', text: 'Future: user-named collections from saved items', label: 'Wardrobe custom collections are honestly future-disabled' },
  { file: 'app/profile/page.tsx', text: 'Style archetype', label: 'Profile DNA report exists' },
  { file: 'app/profile/page.tsx', text: 'Computed from your real saved fits + closet', label: 'Profile stats are real-data framed' },
  { file: 'app/saved/page.tsx', text: 'Create collection', label: 'Saved future collection card exists' },
  { file: 'app/checkout/page.tsx', text: 'No checkout session yet', label: 'Checkout empty state exists' },
  // ── AI stylist architecture (Phase 1 of cutout+AI sprint) ────────
  { file: 'lib/stylist/types.ts', text: 'StylistContext', label: 'Syli types module exists' },
  { file: 'lib/stylist/context.ts', text: 'buildStylistContext', label: 'Syli context builder exists' },
  { file: 'lib/stylist/local-response.ts', text: 'generateLocalStylistResponse', label: 'Syli local response engine exists' },
  { file: 'app/api/stylist/route.ts', text: 'local_fallback', label: 'Syli API boundary is honest local-fallback' },
  // ── Cutout / transparent-image architecture ──────────────────────
  { file: 'components/ProductImage.tsx', text: 'imageTransparentUrl', label: 'ProductImage supports transparent image variant' },
  { file: 'components/ProductImage.tsx', text: 'data-image-kind', label: 'ProductImage tags image kind for observability' },
  { file: 'components/ProductImage.tsx', text: "'missing'", label: 'ProductImage exposes missing image state' },
  { file: 'components/CatalogRuntimeProof.tsx', text: 'Transparent Runtime Proof', label: 'Catalog Lab has runtime transparent proof panel' },
  { file: 'app/feed/page.tsx', text: 'transparentExperiment', label: 'Feed transparent experiment flag exists' },
  { file: 'app/build/page.tsx', text: 'transparentExperiment', label: 'Build transparent experiment flag exists' },
  { file: 'lib/catalog-schemas/product.v2.ts', text: 'TRANSPARENT_URL_NOT_STRING', label: 'Product schema validates transparent URL' },
  { file: 'scripts/catalog-image-audit.ts', text: 'needs-cutout', label: 'Catalog image audit script exists' },
  { file: 'scripts/prepare-cutout-candidates.ts', text: 'Cutout candidate plan', label: 'Cutout candidate prep script exists' },
  { file: 'scripts/generate-cutouts-local.py', text: 'Default mode is dry-run', label: 'Local cutout generator is dry-run by default' },
  { file: 'scripts/register-cutouts.ts', text: 'data/catalog-cutout-overrides.json', label: 'Cutout registration writes reviewed override layer only' },
  { file: 'scripts/catalog-coverage.ts', text: 'Catalog Coverage', label: 'Catalog coverage script exists' },
  { file: 'scripts/catalog-expansion-plan.ts', text: 'Catalog Expansion Plan', label: 'Catalog expansion plan script exists' },
  { file: 'scripts/searchapi-catalog-expand.ts', text: 'DRY RUN BY DEFAULT', label: 'SearchAPI expand is dry-run by default' },
  { file: 'scripts/searchapi-catalog-expand.ts', text: 'SEARCHAPI_LIVE', label: 'SearchAPI expand requires explicit live env flag' },
  { file: 'app/catalog-lab/page.tsx', text: 'Catalog Lab · local read-only', label: 'Catalog Lab is read-only and clearly labeled' },
];

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function source(file: string): string {
  const target = path.join(root, file);
  if (!existsSync(target)) fail(`missing source file: ${file}`);
  return readFileSync(target, 'utf8');
}

function gitOutput(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

console.log('Route smoke audit');
console.log('=================');

for (const file of routeFiles) {
  const target = path.join(root, file);
  if (!existsSync(target)) fail(`missing route file: ${file}`);
  console.log(`PASS route exists: ${file}`);
}

for (const check of requiredText) {
  const content = source(check.file);
  if (!content.includes(check.text)) fail(`${check.label} (${check.file})`);
  console.log(`PASS ${check.label}`);
}

const sourceRoots = ['app', 'components', 'store'];
const bannedPhrases = [
  { pattern: /\bfollowers?\b/i, label: 'fake follower language' },
  { pattern: /fake likes/i, label: 'fake likes language' },
  { pattern: /trending with friends/i, label: 'fake friend trend language' },
  { pattern: /generated by AI/i, label: 'AI generation claim without backend' },
  { pattern: /powered by gpt/i, label: 'GPT branding claim without backend' },
  { pattern: /background removed/i, label: 'background-removal claim — only allowed once transparent assets are wired end-to-end' },
];

for (const relativeRoot of sourceRoots) {
  const files = gitOutput(['ls-files', relativeRoot])
    .split(/\r?\n/)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));

  for (const file of files) {
    const content = source(file);
    for (const banned of bannedPhrases) {
      if (banned.pattern.test(content)) fail(`${banned.label}: ${file}`);
    }
  }
}
console.log('PASS no obvious fake social or AI-generation phrases');

if (gitOutput(['ls-files', 'ruvector.db'])) fail('ruvector.db is tracked');
console.log('PASS ruvector.db is not tracked');

if (gitOutput(['status', '--short', '--', 'package.json'])) fail('package.json has uncommitted changes');
console.log('PASS package.json is unchanged');

console.log('');
console.log('Overall: PASS');
