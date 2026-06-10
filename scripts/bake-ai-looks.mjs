/**
 * Nightly AI look bake — has Claude compose REAL outfits offline and stores
 * them in data/ai-look-library.json, so the scroll serves genuinely AI-styled
 * fits at $0 marginal cost. Only `source: 'ai'` responses are stored; the
 * deterministic engine never sneaks into the AI library.
 *
 * Cost control (hard lines, all overridable via env):
 *   AI_BAKE_LOOKS    target looks per run        (default 22)
 *   AI_BAKE_MAX_USD  estimated spend ceiling     (default 0.40)
 * At ~$0.015/look on the Haiku composer this is ~$0.33/night ≈ $10/month.
 *
 * Usage: node scripts/bake-ai-looks.mjs [baseUrl]
 *   (an app server with ANTHROPIC_API_KEY must be running at baseUrl)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3939';
const TARGET = Number(process.env.AI_BAKE_LOOKS || 22);
const MAX_USD = Number(process.env.AI_BAKE_MAX_USD || 0.4);
const EST_COST_PER_CALL = 0.015;
const MAX_CONSECUTIVE_NON_AI = 4;
const LIBRARY_CAP = 600;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LIBRARY_PATH = path.join(ROOT, 'data', 'ai-look-library.json');
const CATALOG_PATH = path.join(ROOT, 'data', 'client-catalog.json');

const VIBES = ['street', 'clean', 'night', 'cozy', 'date', 'edgy', 'office', 'preppy', 'vacation', 'gym'];
const FRAMES = ['androgynous', 'masc', 'fem'];
const BUDGETS = ['any', 'under250', 'under500'];
const SLOT_TEMPLATES = [
  ['outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry'],
  ['hat', 'outer', 'top', 'bottom', 'shoes', 'bag'],
  ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry', 'hat'],
  ['top', 'bottom', 'shoes', 'hat', 'eyewear', 'bag'],
];

function clientCatalogIds() {
  const raw = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const products = Array.isArray(raw) ? raw : raw.products || [];
  return new Set(products.map((p) => p.id));
}

function loadLibrary() {
  try {
    const data = JSON.parse(readFileSync(LIBRARY_PATH, 'utf8'));
    return { version: 1, looks: [], ...data };
  } catch {
    return { version: 1, looks: [] };
  }
}

function signature(slots) {
  return Object.values(slots).sort().join('|');
}

async function main() {
  const validIds = clientCatalogIds();
  const library = loadLibrary();
  const existingSignatures = new Set(library.looks.map((l) => signature(l.slots)));
  const recentIds = library.looks.slice(-30).flatMap((l) => Object.values(l.slots)).slice(-120);

  // Day-seeded plan: walk every vibe × frame combo in a rotating order.
  const dayStamp = new Date().toISOString().slice(0, 10);
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const combos = [];
  for (const vibe of VIBES) for (const frame of FRAMES) combos.push({ vibe, frame });
  const offset = dayNumber % combos.length;
  const plan = [...combos.slice(offset), ...combos.slice(0, offset)];

  let added = 0;
  let calls = 0;
  let nonAiStreak = 0;
  const failures = [];

  for (let i = 0; added < TARGET && i < plan.length * 2; i += 1) {
    if (calls * EST_COST_PER_CALL >= MAX_USD) {
      console.log(`spend ceiling hit (~$${(calls * EST_COST_PER_CALL).toFixed(2)}) — stopping`);
      break;
    }
    if (nonAiStreak >= MAX_CONSECUTIVE_NON_AI) {
      console.error(`${MAX_CONSECUTIVE_NON_AI} consecutive non-AI responses — key/budget problem, aborting`);
      break;
    }
    const { vibe, frame } = plan[i % plan.length];
    const seed = dayNumber * 7919 + i * 37;
    calls += 1;
    try {
      const res = await fetch(`${BASE}/api/look`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vibe,
          frame,
          budget: BUDGETS[i % BUDGETS.length],
          mode: 'full',
          seed,
          selectedSlots: SLOT_TEMPLATES[i % SLOT_TEMPLATES.length],
          diversityStrength: 'high',
          avoidProductIds: recentIds,
        }),
      });
      const data = await res.json();
      if (data.source !== 'ai') {
        nonAiStreak += 1;
        failures.push(`${vibe}/${frame}: source=${data.source}`);
        continue;
      }
      nonAiStreak = 0;
      const slots = {};
      for (const [slot, product] of Object.entries(data.products || {})) {
        if (product?.id && validIds.has(product.id)) slots[slot] = product.id;
      }
      const slotCount = Object.keys(slots).length;
      if (slotCount < 4 || !slots.top || !slots.bottom || !slots.shoes) {
        failures.push(`${vibe}/${frame}: only ${slotCount} client-renderable slots`);
        continue;
      }
      const sig = signature(slots);
      if (existingSignatures.has(sig)) {
        failures.push(`${vibe}/${frame}: duplicate combo`);
        continue;
      }
      existingSignatures.add(sig);
      recentIds.push(...Object.values(slots));
      library.looks.push({
        id: `syli-${dayStamp}-${seed}`,
        vibe,
        frame,
        slots,
        stylingNotes: typeof data.stylingNotes === 'string' ? data.stylingNotes.slice(0, 280) : undefined,
        palette: Array.isArray(data.palette) ? data.palette.slice(0, 6) : undefined,
        formulaLabel: data.formula?.label,
        bakedAt: dayStamp,
      });
      added += 1;
      console.log(`baked ${added}/${TARGET}: ${vibe}/${frame} (${slotCount} pieces)`);
    } catch (error) {
      failures.push(`${vibe}/${frame}: ${error.message}`);
      nonAiStreak += 1;
    }
  }

  if (library.looks.length > LIBRARY_CAP) {
    library.looks = library.looks.slice(-LIBRARY_CAP);
  }
  writeFileSync(LIBRARY_PATH, `${JSON.stringify(library, null, 2)}\n`);

  console.log(`\nDone: +${added} AI looks (library total ${library.looks.length}) · ${calls} calls ≈ $${(calls * EST_COST_PER_CALL).toFixed(2)}`);
  if (failures.length) console.log(`skips: ${failures.slice(0, 8).join(' · ')}`);
  if (added === 0) process.exit(1);
}

main();
