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

// INDEPENDENT comprehensive detector — intentionally broader than the generator's
// classifier so it catches anything that slips through (the whole point of a test).
const WOMEN = /\bwomen'?s?\b|\bwmns\b|\bladies\b|\bgirls?\b|\bskirt\b|\bskort\b|\bblouse\b|\bcami\b|camisole|bodysuit|\bhalter\b|bandeau|\bcorset\b|bustier|\bromper\b|playsuit|catsuit|\bmidi\b|\bmaxi\b|\bdress(es)?\b|crop top|cropped top|cropped polo|cropped tee|cropped cami|cropped tank|tube top|tube dress|scoop neck|scoop tank|square neck|sweetheart|off.?shoulder|one.?shoulder|wrap top|wrap dress|peplum|ruched|smocked|milkmaid|sports bra|bralette|bra top|align tank|aspire tank|\blegging|jegging|airbrush|airlift|alosoft|biker short|micro short|booty short|slingback|ballet flat|ballerina flat|kitten heel|\bmule\b|mary jane|stiletto|\bpumps?\b|\bheels?\b|\balo yoga\b|set active|reformation|\bganni\b|free people|\bvarley\b|beyond yoga|girlfriend collective|outdoor voices|good american|\bspanx\b|princess polly|white fox|\bmeshki\b|oh polly|house of cb|cult gaia|\bstaud\b|edikted|\bskims\b|aritzia|babaton|wilfred/;
const MEN = /\bmen'?s?\b|\bmens\b|\bboys?\b|\bboxer|necktie|tuxedo/;

function inferGender(p) {
  const raw = `${p.brand || ''} ${p.name || ''}`.toLowerCase();
  const s = raw.replace(/dress\s+(shirt|pant|pants|shoe|shoes|trouser|trousers|sock|socks|code)/g, 'x');
  const w = WOMEN.test(s);
  const m = MEN.test(s);
  if (w && m) return 'neutral';
  const tag = (p.gender || [])[0];
  if (w || tag === 'fem') return 'female';
  if (m || tag === 'masc') return 'male';
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
