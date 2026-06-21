/**
 * Outfit coherence layers — make automated selection genuinely "styled".
 *
 * Pure + dependency-free (jiti-testable). Per-CANDIDATE (matches the catalog
 * scorer): each helper scores how well a candidate piece coheres with the pieces
 * already chosen. Tie-breaker magnitudes (tens of points) so they coordinate
 * AMONG vibe-appropriate candidates without overriding vibe/frame/budget fit.
 * Layers onto [[color-harmony]]. Every layer degrades to 0 on missing tags by
 * design — so as catalog tag coverage grows (via auto-ingestion), they bite more.
 *
 * Sources: menswear formality-spectrum (Gentleman's Gazette, Permanent Style);
 * seasonal fabric weight (ATL Tailor). Coverage audited 2026-06-20: formality
 * signal ~33% of the catalog, fabric ~23%.
 */

// ── Formality: a 0–3 band; coordinated outfits keep LOW spread ───────────────
const FORMALITY_BANDS: { level: number; words: string[] }[] = [
  { level: 3, words: ['blazer', 'suit', 'tuxedo', 'sport coat', 'trouser', 'dress pant', 'dress shirt', 'oxford shirt', 'gown', 'heel', 'pump', 'loafer', 'derby', 'brogue', 'chelsea', 'dress boot', 'silk', 'satin', 'tailored'] },
  { level: 2, words: ['chino', 'button-down', 'ocbd', 'chambray', 'polo', 'knit', 'sweater', 'cardigan', 'midi', 'blouse', 'ballet flat', 'chukka', 'mule', 'overshirt', 'pleated'] },
  { level: 1, words: ['jean', 'denim', 't-shirt', 'tee', 'skirt', 'dress', 'flannel', 'sneaker', 'boot', 'jacket', 'shorts', 'cargo'] },
  { level: 0, words: ['hoodie', 'sweatpant', 'jogger', 'track', 'legging', 'gym', 'athletic', 'sport bra', 'flip-flop', 'slide', 'running', 'windbreaker'] },
];

/** 0=athletic, 1=casual (default), 2=smart-casual, 3=formal. First match wins. */
export function formalityLevel(text: string): number {
  for (const band of FORMALITY_BANDS) if (band.words.some((w) => text.includes(w))) return band.level;
  return 1;
}

/** Penalise a candidate that widens the outfit's formality spread (sneakers + suit). */
export function formalityCoherenceScore(candidateText: string, selectedTexts: string[]): number {
  if (!selectedTexts.length) return 0;
  const levels = [formalityLevel(candidateText), ...selectedTexts.map(formalityLevel)];
  const spread = Math.max(...levels) - Math.min(...levels);
  const TABLE = [8, 2, -8, -18]; // spread 0..3
  let score = TABLE[spread] ?? 0;
  if (levels.includes(0) && levels.includes(3)) score -= 8; // athletic + formal: the worst clash
  return score;
}

// ── Fabric season: penalise a hot + cold weight clash (linen + flannel) ──────
const HOT_FABRIC = ['linen', 'seersucker', 'chambray', 'poplin', 'mesh', 'eyelet', 'crochet', 'tropical wool', 'terry'];
// NB no bare 'down' — it false-matches "button-down" (a shirt). Real down-weather
// pieces are caught by puffer/shearling/fleece + the garment-level season check.
const COLD_FABRIC = ['wool', 'fleece', 'flannel', 'cashmere', 'corduroy', 'puffer', 'shearling', 'sherpa', 'tweed', 'velvet'];

export function fabricSeason(text: string): 'hot' | 'cold' | 'neutral' {
  if (COLD_FABRIC.some((w) => text.includes(w))) return 'cold';
  if (HOT_FABRIC.some((w) => text.includes(w))) return 'hot';
  return 'neutral';
}

/** Subordinate to the existing garment-level season check; a small −10 tie-breaker. */
export function fabricCoherenceScore(candidateText: string, selectedTexts: string[]): number {
  if (!selectedTexts.length) return 0;
  const seasons = [fabricSeason(candidateText), ...selectedTexts.map(fabricSeason)];
  if (seasons.includes('hot') && seasons.includes('cold')) return -10;
  return 0;
}
