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
  'oatmeal', 'taupe', 'brown', 'chocolate', 'espresso', 'mocha',
];

export const ACCENT_COLORS = [
  'red', 'crimson', 'burgundy', 'maroon', 'pink', 'fuchsia', 'rose', 'orange',
  'rust', 'coral', 'peach', 'yellow', 'mustard', 'gold', 'lime', 'green', 'olive',
  'sage', 'emerald', 'teal', 'aqua', 'mint', 'blue', 'cobalt', 'indigo', 'purple',
  'lavender', 'lilac', 'plum', 'violet',
];

/**
 * Which palette colours appear as WHOLE WORDS in `text` (lowercased upstream).
 * Word-level (split on non-letters) not substring — so short colour words don't
 * false-match inside other words ('red' in "shredded", 'tan' in "titanium"),
 * while compounds with separators still hit ("navy-blue" → navy + blue).
 */
export function colorTokens(text: string, palette: string[]): Set<string> {
  const words = new Set(text.split(/[^a-z]+/));
  const found = new Set<string>();
  for (const color of palette) if (words.has(color)) found.add(color);
  return found;
}

/**
 * Representative swatch hex for a palette word — covers every NEUTRAL/ACCENT word
 * plus the fashion words Syli's curated palettes tend to use. Unknown word → null
 * so the caller skips that dot (the palette row degrades gracefully, never errors).
 */
const COLOR_SWATCH: Record<string, string> = {
  // neutrals
  black: '#1a1a1c', white: '#f4f1ea', cream: '#efe7d6', ivory: '#f0e9da',
  beige: '#d8c7ad', tan: '#c8a878', khaki: '#b3a276', greige: '#c2b6a4',
  grey: '#9a9a9e', gray: '#9a9a9e', charcoal: '#3a3a3e', stone: '#b8afa3',
  camel: '#c19a6b', navy: '#20304f', denim: '#51688c', silver: '#c5c7cc',
  nude: '#e3c4ab', sand: '#d8c4a0', oatmeal: '#ddd2bd', taupe: '#b09a86',
  brown: '#6b4a33', chocolate: '#4a3122', espresso: '#3a281d', mocha: '#6f4e3a',
  // accents
  red: '#b5392f', crimson: '#b21f37', burgundy: '#6b2233', maroon: '#5c2230',
  pink: '#e89ab0', fuchsia: '#c2317e', rose: '#d98a9a', orange: '#d9772f',
  rust: '#9e4a2a', coral: '#e3735e', peach: '#f0b89a', yellow: '#e8c75a',
  mustard: '#c9a234', gold: '#c2a04a', lime: '#a7c044', green: '#4a7c52',
  olive: '#6b7340', sage: '#9aa988', emerald: '#2f7d5a', teal: '#2f7d80',
  aqua: '#67c0c4', mint: '#a8d8c0', blue: '#3a6ea5', cobalt: '#2b4d9e',
  indigo: '#3a3f7a', purple: '#6b4a8c', lavender: '#b9a8d8', lilac: '#c4aed4',
  plum: '#6e3a5c', violet: '#7a4a9e',
  // common Syli-palette extras (not in the scorer's word lists)
  champagne: '#e6d3a8', forest: '#2c4a35', terracotta: '#b5613f', wine: '#5c2230',
  slate: '#5a6470', blush: '#e8c2c8', cognac: '#9a5a32', caramel: '#b07a40',
  butter: '#ecd9a0', ecru: '#dcd2bd',
};

/** Swatch hex for a palette word, or null when the word has no known colour. */
export function colorSwatch(word: string): string | null {
  return COLOR_SWATCH[word.toLowerCase()] ?? null;
}

/**
 * The colour story of a look, derived from its pieces' text — accents lead (the
 * statement colours), neutrals ground. Used to render palette swatch dots for
 * engine looks, which (unlike Syli looks) carry no pre-curated palette.
 */
export function derivePalette(text: string, max = 4): string[] {
  const accents = [...colorTokens(text, ACCENT_COLORS)];
  const neutrals = [...colorTokens(text, NEUTRAL_COLORS)];
  return [...accents, ...neutrals].slice(0, max);
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
