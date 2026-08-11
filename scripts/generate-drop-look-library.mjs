#!/usr/bin/env node
/** Build a small, fresh-positive Daily Drop artifact from the large outfit library. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'data/client-catalog.json');
const HEALTH_PATH = join(ROOT, 'data/catalog-health.json');
const OUTFITS_PATH = join(ROOT, 'data/outfit-library.json');
const OUTPUT_PATH = join(ROOT, 'data/drop-look-library.json');
const MAX_PER_VIBE = 10;
const MAX_TOTAL_CENTS = 50_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const REQUIRED = ['top', 'bottom', 'shoes'];

function stableId(vibe, ids) {
  return `drop-${vibe}-${createHash('sha1').update(ids.join('|')).digest('hex').slice(0, 14)}`;
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const health = JSON.parse(readFileSync(HEALTH_PATH, 'utf8'));
  const library = JSON.parse(readFileSync(OUTFITS_PATH, 'utf8'));
  if (health.schemaVersion < 2 || !health.products || !health.generatedAt) {
    throw new Error('A schema-v2 health sweep is required before generating Daily Drop looks.');
  }
  const generatedMs = Date.parse(health.generatedAt);
  const now = Date.now();
  const generatedAgeMs = now - generatedMs;
  if (
    !Number.isFinite(generatedMs)
    || generatedAgeMs < -MAX_FUTURE_SKEW_MS
    || generatedAgeMs > MAX_AGE_MS
  ) {
    throw new Error('Catalog health evidence must be current (<=24 hours old, <=5 minutes future skew). Run npm run health:sweep first.');
  }

  const byId = new Map(catalog.map((product) => [product.id, product]));
  const unavailable = new Set(health.unavailable || []);
  const isFreshAvailable = (product) => {
    const record = health.products[product.id];
    const checkedMs = Date.parse(record?.checkedAt || '');
    const checkedAgeMs = now - checkedMs;
    return product.trusted !== false
      && product.inStock !== false
      && !unavailable.has(product.id)
      && record?.outcome === 'available'
      && record.exactPdp !== false
      && Number.isFinite(checkedMs)
      && checkedAgeMs >= -MAX_FUTURE_SKEW_MS
      && checkedAgeMs <= MAX_AGE_MS
      && generatedMs - checkedMs >= -MAX_FUTURE_SKEW_MS;
  };

  const outputLooks = {};
  const selectedProductIds = new Set();
  const selectionUse = new Map();
  for (const [vibe, byFrame] of Object.entries(library.looks || {})) {
    const rows = byFrame.androgynous || [];
    const candidates = [];
    const seen = new Set();
    for (const row of rows) {
      const slots = {};
      for (let index = 0; index < library.slots.length; index += 1) {
        const idIndex = row[index];
        if (!Number.isInteger(idIndex) || idIndex < 0) continue;
        const id = library.ids[idIndex];
        const product = byId.get(id);
        if (product) slots[library.slots[index]] = product;
      }
      const products = Object.values(slots);
      if (!REQUIRED.every((slot) => slots[slot])) continue;
      if (!products.every(isFreshAvailable)) continue;
      if (products.reduce((sum, product) => sum + (product.priceCents || 0), 0) > MAX_TOTAL_CENTS) continue;
      const signature = Object.entries(slots).sort().map(([slot, product]) => `${slot}:${product.id}`).join('|');
      if (seen.has(signature)) continue;
      seen.add(signature);
      candidates.push({ slots, signature });
    }

    const selected = [];
    while (selected.length < MAX_PER_VIBE && candidates.length) {
      candidates.sort((left, right) => {
        const reuse = (candidate) => Object.values(candidate.slots)
          .reduce((sum, product) => sum + (selectionUse.get(product.id) || 0), 0);
        return reuse(left) - reuse(right) || left.signature.localeCompare(right.signature);
      });
      const winner = candidates.shift();
      selected.push(winner);
      for (const product of Object.values(winner.slots)) {
        selectedProductIds.add(product.id);
        selectionUse.set(product.id, (selectionUse.get(product.id) || 0) + 1);
      }
    }
    outputLooks[vibe] = selected.map(({ slots }) => {
      const slotIds = Object.fromEntries(Object.entries(slots).map(([slot, product]) => [slot, product.id]));
      return {
        id: stableId(vibe, Object.entries(slotIds).sort().map(([slot, id]) => `${slot}:${id}`)),
        slots: slotIds,
      };
    });
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    verifiedAt: health.generatedAt,
    maxHealthAgeHours: 24,
    products: catalog.filter((product) => selectedProductIds.has(product.id)),
    looks: outputLooks,
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 1)}\n`, 'utf8');
  const count = Object.values(outputLooks).reduce((sum, looks) => sum + looks.length, 0);
  console.log(`wrote ${count} fresh-positive Daily Drop looks using ${payload.products.length} products`);
}

main();
