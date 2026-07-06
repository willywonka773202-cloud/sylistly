// Score the cutouts from the latest generate-cutouts-local run and DELETE the
// body-model shots (modelScore >= 20) so they never register into the catalog.
// Run: npx jiti scripts/score-cutout-batch.ts [--apply]
// ponytail: batch QA for ingested Shopify images — on-model teen-store photos
// rembg into person-cutouts; this is the kill filter before register-cutouts.
import { readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { cutoutModelMetrics } from './cutout-model-score';

const ROOT = path.join(__dirname, '..');
const report = JSON.parse(readFileSync(path.join(ROOT, 'data/catalog/cutout-reviewed/cutout-run-report.json'), 'utf8'));
const apply = process.argv.includes('--apply');
const THRESHOLD = 20;

(async () => {
  let kept = 0, killed = 0;
  for (const item of report.items) {
    if (item.status !== 'generated' || !item.outputPath) continue;
    const abs = path.join(ROOT, item.outputPath);
    const m = await cutoutModelMetrics(abs);
    // Second signature: full-body model shots that dodge modelScore — any
    // mid-level skin plus skin in the top third (a face). Tuned by montage
    // 2026-07-06: kills ~93% people at ~7% warm-garment collateral.
    const personShot = m.skinPct >= 1.5 && m.topSkinPct >= 1.0;
    if (m.modelScore >= THRESHOLD || personShot) {
      killed++;
      console.log(`KILL ${item.id} score=${Math.round(m.modelScore)} ${item.brand} — ${item.name}`);
      if (apply) unlinkSync(abs);
    } else {
      kept++;
    }
  }
  console.log(`${apply ? 'deleted' : 'would delete'} ${killed}, kept ${kept}`);
})();
