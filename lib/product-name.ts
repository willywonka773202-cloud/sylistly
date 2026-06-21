/**
 * Clean a product name for display.
 *
 * Pure + dependency-free (no `@/` imports) so it's unit-testable via the jiti
 * runner. Two common scraping artifacts make names read unpolished beside the
 * brand eyebrow:
 *  1. ~36% of catalog names redundantly REPEAT their brand
 *     ("Aritzia Babaton Notable Viscose Cardigan" with brand "Aritzia") — the
 *     brand then shows twice (eyebrow + name).
 *  2. A few carry a trailing SIZE token ("…Shirt - Black / XL") — size is picked
 *     at the retailer, not here.
 * We strip a redundant leading brand and an unambiguous trailing size, keeping
 * colour/variant. Idempotent; never returns empty.
 */
export function cleanProductName(name: string, brand?: string): string {
  let n = (name || '').trim();
  if (!n) return name;

  // 1. Drop a redundant leading brand (the eyebrow already shows it).
  if (brand && brand.trim()) {
    const b = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stripped = n.replace(new RegExp(`^${b}\\s*[-–:|]?\\s*`, 'i'), '').trim();
    if (stripped.length >= 3) n = stripped; // don't strip name down to nothing
  }

  // 2. Drop an UNAMBIGUOUS trailing size token (skip bare S/M/L and bare numbers
  //    — those collide with model codes like "MA-1" / "501").
  n = n.replace(/\s*[-–/|]\s*(XXS|XS|XXL|XXXL|XL|One Size|OS|US ?\d{1,2}(\.\d)?)\s*$/i, '').trim();

  return n || name;
}
