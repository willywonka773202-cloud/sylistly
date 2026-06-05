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
  { file: 'components/BottomNav.tsx', text: 'href="/"', label: 'BottomNav links Home tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/feed"', label: 'BottomNav links Feed tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/build"', label: 'BottomNav center Create opens Builder' },
  { file: 'components/BottomNav.tsx', text: 'href="/stylist"', label: 'BottomNav links Syli tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/wardrobe"', label: 'BottomNav links Closet tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/profile"', label: 'BottomNav links Profile tab' },
  { file: 'app/page.tsx', text: 'Build. Save. Edit.', label: 'Home has current app entry hero' },
  { file: 'app/page.tsx', text: 'Catalog spotlight', label: 'Home exposes real catalog actions' },
  { file: 'app/stylist/page.tsx', text: 'Syli now calls the server stylist API', label: 'Stylist is API-backed with fallback messaging' },
  { file: 'app/stylist/page.tsx', text: 'Pieces Syli can use', label: 'Stylist exposes real catalog picks' },
  { file: 'app/canvas/page.tsx', text: 'Manual outfit editor', label: 'Canvas editor route is present' },
  { file: 'app/canvas/page.tsx', text: 'OutfitCanvasEditor', label: 'Canvas mounts the editable outfit editor' },
  { file: 'app/discover/page.tsx', text: 'Budget finds', label: 'Discover budget rail exists' },
  { file: 'app/discover/page.tsx', text: 'Premium picks', label: 'Discover premium rail exists' },
  { file: 'app/discover/page.tsx', text: 'Underused gems', label: 'Discover underused rail exists' },
  { file: 'app/wardrobe/page.tsx', text: 'Wardrobe gap', label: 'Wardrobe gap guidance exists' },
  { file: 'app/wardrobe/page.tsx', text: 'Open builder', label: 'Wardrobe empty state links Builder' },
  { file: 'app/profile/page.tsx', text: 'Style archetype', label: 'Profile DNA report exists' },
  { file: 'app/profile/page.tsx', text: 'Computed from your real saved fits + closet', label: 'Profile stats are real-data framed' },
  { file: 'app/saved/page.tsx', text: 'Saved actions', label: 'Saved has real follow-up actions' },
  { file: 'components/CheckoutSheet.tsx', text: 'Review checkout', label: 'Checkout sheet links review page' },
  { file: 'app/checkout/page.tsx', text: 'No checkout session yet', label: 'Checkout empty state exists' },
  // ── AI stylist architecture (Phase 1 of cutout+AI sprint) ────────
  { file: 'lib/stylist/types.ts', text: 'StylistContext', label: 'Syli types module exists' },
  { file: 'lib/stylist/context.ts', text: 'buildStylistContext', label: 'Syli context builder exists' },
  { file: 'lib/stylist/local-response.ts', text: 'generateLocalStylistResponse', label: 'Syli local response engine exists' },
  { file: 'app/api/stylist/route.ts', text: 'generateApiStylistResponse', label: 'Syli API boundary calls response engine' },
  // ── Cutout / transparent-image architecture ──────────────────────
  { file: 'components/ProductImage.tsx', text: 'imageTransparentUrl', label: 'ProductImage supports transparent image variant' },
  { file: 'components/ProductImage.tsx', text: 'data-image-kind', label: 'ProductImage tags image kind for observability' },
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

console.log('');
console.log('Overall: PASS');
