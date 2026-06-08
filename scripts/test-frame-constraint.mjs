/**
 * Proves the gender/frame hard-constraint: the pre-generated outfit library
 * (the builder's primary source) must NEVER place a women-only piece in a masc
 * outfit, nor a men-only piece in a fem outfit. Mirrors the inferGender() used
 * by scripts/generate-outfit-library.mjs. Exits non-zero on any violation.
 *
 * Run:  npm run test:frame
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = JSON.parse(readFileSync(join(ROOT, 'data/outfit-library.json'), 'utf8'));
const cat = JSON.parse(readFileSync(join(ROOT, 'data/client-catalog.json'), 'utf8'));
const arr = Array.isArray(cat) ? cat : cat.products || Object.values(cat)[0];
const byId = new Map(arr.map((p) => [p.id, p]));

function inferGender(p) {
  const raw = `${p.brand || ''} ${p.name || ''}`.toLowerCase();
  const womens = /\bwomen'?s?\b|\bwmns\b|\bwomens\b|\bladies\b|\bgirls?\b/.test(raw);
  const mens = /\bmen'?s?\b|\bmens\b|\bboys?\b/.test(raw);
  if (womens && mens) return 'neutral';
  const s = raw.replace(/dress\s+(shirt|pant|pants|shoe|shoes|trouser|trousers|sock|socks|code)/g, 'x');
  const femGarment = /\bskirt\b|\bblouse\b|\bcami\b|bodysuit|\bhalter\b|\bromper\b|jumpsuit|\bcorset\b|bustier|\bmidi\b|\bmaxi\b|slingback|ballet flat|\bpumps?\b|stiletto|\bdress(es)?\b/.test(s);
  const femJewelry = p.category === 'jewelry'
    && /earring|dainty|delicate|birthstone|\bcharm|pearl|dewdrop|moonstone|stacking|huggie|\bstud|solitaire|ombre/.test(raw);
  const tag = (p.gender || [])[0];
  if (womens || femGarment || femJewelry || tag === 'fem') return 'female';
  if (mens || tag === 'masc') return 'male';
  return 'neutral';
}

const SLOTS = lib.slots;
let mascPieces = 0;
let femPieces = 0;
const mascViolations = [];
const femViolations = [];

for (const vibe of Object.keys(lib.looks)) {
  for (const [frame, rows] of Object.entries(lib.looks[vibe])) {
    for (const row of rows) {
      for (let i = 0; i < SLOTS.length; i += 1) {
        if (row[i] < 0) continue;
        const product = byId.get(lib.ids[row[i]]);
        if (!product) continue;
        const g = inferGender(product);
        if (frame === 'masc') {
          mascPieces += 1;
          if (g === 'female') mascViolations.push(`${vibe}/masc ${SLOTS[i]} → ${product.name}`);
        } else if (frame === 'fem') {
          femPieces += 1;
          if (g === 'male') femViolations.push(`${vibe}/fem ${SLOTS[i]} → ${product.name}`);
        }
      }
    }
  }
}

console.log(`Checked ${mascPieces} masc-frame pieces and ${femPieces} fem-frame pieces across the library.`);
console.log(`Women-only pieces in masc fits: ${mascViolations.length}`);
console.log(`Men-only pieces in fem fits:    ${femViolations.length}`);
if (mascViolations.length) console.log('\nMASC violations:\n  ' + mascViolations.slice(0, 15).join('\n  '));
if (femViolations.length) console.log('\nFEM violations:\n  ' + femViolations.slice(0, 15).join('\n  '));

const pass = mascViolations.length === 0 && femViolations.length === 0;
console.log(pass
  ? '\n✅ PASS — menswear never composes a women-only piece, and vice versa.'
  : '\n❌ FAIL — gender constraint leaked.');
process.exit(pass ? 0 : 1);
