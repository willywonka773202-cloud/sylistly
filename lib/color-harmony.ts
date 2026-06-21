/**
 * Outfit colour coordination — the core of "pieces that actually go together".
 *
 * Pure + dependency-free (no `@/` imports, no catalog) so it's unit-testable via
 * the standalone jiti runner. Text-based: colour words live in a product's
 * searchable text, consistent with the rest of the catalog scorer.
 *
 * The model: NEUTRALS anchor a look (they coordinate with anything); ACCENTS are
 * statement colours, and a coordinated outfit limits itself to ~2 of them. The
 * scorer rewards a neutral-anchored, tonal palette and penalises every distinct
 * accent beyond the 2nd — so the generator stops assembling busy
 * red+green+orange clashes and favours intentional, editorial fits.
 */

export const NEUTRAL_COLORS = [
  'black', 'white', 'cream', 'ivory', 'beige', 'tan', 'khaki', 'greige', 'grey',
  'gray', 'charcoal', 'stone', 'camel', 'navy', 'denim', 'silver', 'nude', 'sand',
  'oatmeal', 'taupe',
];

export const ACCENT_COLORS = [
  'red', 'crimson', 'burgundy', 'maroon', 'pink', 'fuchsia', 'rose', 'orange',
  'rust', 'coral', 'peach', 'yellow', 'mustard', 'gold', 'lime', 'green', 'olive',
  'sage', 'emerald', 'teal', 'aqua', 'mint', 'blue', 'cobalt', 'indigo', 'purple',
  'lavender', 'lilac', 'plum', 'violet', 'brown', 'chocolate',
];

/** Which palette colours appear as words in `text` (already lowercased upstream). */
export function colorTokens(text: string, palette: string[]): Set<string> {
  const found = new Set<string>();
  for (const color of palette) if (text.includes(color)) found.add(color);
  return found;
}

/**
 * Score how well a candidate piece's colours coordinate with the colours already
 * in the look. Higher = more coordinated. Magnitudes are tie-breaker-sized (tens)
 * so colour coordinates AMONG vibe-appropriate candidates without overriding
 * vibe/frame/formality fit.
 */
export function colorHarmonyScore(candidateText: string, selectedText: string): number {
  const candAccents = colorTokens(candidateText, ACCENT_COLORS);
  const candNeutrals = colorTokens(candidateText, NEUTRAL_COLORS);
  const selAccents = colorTokens(selectedText, ACCENT_COLORS);
  const selNeutrals = colorTokens(selectedText, NEUTRAL_COLORS);

  let score = 0;
  // A neutral, accent-free piece anchors the look — it coordinates with anything.
  if (!candAccents.size) score += 12;
  // Tonal cohesion: the candidate repeats an accent already worn → reads on-purpose.
  if ([...candAccents].some((color) => selAccents.has(color))) score += 22;
  // A shared neutral base (both navy, both cream…) reads intentional.
  if ([...candNeutrals].some((color) => selNeutrals.has(color))) score += 8;
  // The "≈2 colours" rule: penalise every distinct accent beyond the 2nd.
  const totalAccents = new Set([...candAccents, ...selAccents]).size;
  if (totalAccents >= 3) score -= (totalAccents - 2) * 34;
  return score;
}
