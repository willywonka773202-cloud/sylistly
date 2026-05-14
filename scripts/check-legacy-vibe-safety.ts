import { buildCatalogLook } from '../lib/catalog';
import { repairOrRegenerateOutfit } from '../lib/catalog-health';
import type { VibeId } from '../lib/vibes';

// Stale persisted localStorage (saved fits posted with `vibe: 'Saved'`, social
// feed posts with `vibe: 'Builder'`, etc.) can deliver non-canonical vibe
// strings into buildCatalogLook / repairOrRegenerateOutfit. Without
// canonicalization, OUTFIT_RECIPES[vibe] is undefined and any click that
// triggers an outfit repair (remix, shop saved fit, open saved post) crashes.

const LEGACY_INPUTS: Array<string | null | undefined> = [
  'Saved', 'saved',
  'Builder', 'builder',
  'Night Out', 'night out',
  'Office', 'office',
  'Street', 'street',
  'Preppy', 'preppy',
  'Cozy', 'cozy',
  'Edgy', 'edgy',
  'Remix', 'remix',
  'totally unknown vibe',
  '',
  null,
  undefined,
];

const failures: string[] = [];

for (const input of LEGACY_INPUTS) {
  try {
    buildCatalogLook({
      vibe: input as unknown as VibeId,
      frame: 'androgynous',
      budget: 'under250',
      mode: 'full',
    });
  } catch (error) {
    failures.push(`buildCatalogLook crashed on vibe=${JSON.stringify(input)}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    repairOrRegenerateOutfit({
      items: {},
      vibe: input as unknown as VibeId,
    });
  } catch (error) {
    failures.push(`repairOrRegenerateOutfit crashed on vibe=${JSON.stringify(input)}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error('Legacy vibe safety: FAILED');
  for (const failure of failures.slice(0, 10)) {
    console.error(`  ${failure}`);
  }
  process.exit(1);
}

console.log(`Legacy vibe safety: PASS (buildCatalogLook + repairOrRegenerateOutfit survive ${LEGACY_INPUTS.length} legacy/non-canonical inputs).`);
