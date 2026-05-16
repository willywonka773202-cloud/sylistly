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
  'app/stylist/page.tsx',
];

const requiredText: Array<{ file: string; text: string; label: string }> = [
  { file: 'components/BottomNav.tsx', text: "router.push('/stylist')", label: 'BottomNav links Syli' },
  { file: 'components/BottomNav.tsx', text: "router.push('/canvas')", label: 'BottomNav links Canvas' },
  { file: 'components/BottomNav.tsx', text: "router.push('/saved')", label: 'BottomNav can save current fit' },
  { file: 'app/page.tsx', text: 'Your AI stylist is ready', label: 'Home has fashion OS hero' },
  { file: 'app/stylist/page.tsx', text: 'No backend AI is called here', label: 'Stylist is honest local beta' },
  { file: 'app/canvas/page.tsx', text: 'Generate image disabled', label: 'Try-On is clearly disabled' },
  { file: 'app/discover/page.tsx', text: 'Budget finds', label: 'Discover budget rail exists' },
  { file: 'app/wardrobe/page.tsx', text: 'Closet manager', label: 'Wardrobe insights exist' },
  { file: 'app/profile/page.tsx', text: 'Style archetype', label: 'Profile DNA report exists' },
  { file: 'app/saved/page.tsx', text: 'Create collection', label: 'Saved future collection card exists' },
];

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

console.log('Route smoke audit');
console.log('=================');

for (const file of routeFiles) {
  const target = path.join(root, file);
  if (!existsSync(target)) fail(`missing route file: ${file}`);
  console.log(`PASS route exists: ${file}`);
}

for (const check of requiredText) {
  const target = path.join(root, check.file);
  if (!existsSync(target)) fail(`missing source file: ${check.file}`);
  const content = readFileSync(target, 'utf8');
  if (!content.includes(check.text)) fail(`${check.label} (${check.file})`);
  console.log(`PASS ${check.label}`);
}

console.log('');
console.log('Overall: PASS');
