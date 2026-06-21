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

/**
 * Clean a brand for display. 4.4% of catalog brands are DOMAINS shown as brand
 * names ("farfetch.com", "allvaron.com") — reads like scraped data next to the
 * editorial eyebrow. Strip the TLD; title-case only an all-lowercase root (so
 * "farfetch.com" → "Farfetch" but camel-cased "CustomLids.com" → "CustomLids").
 * Non-domain brands pass through UNCHANGED — preserving legitimately stylised
 * lowercase brands (adidas, lululemon) and dotted brands (A.P.C.).
 */
export function cleanBrand(brand: string): string {
  const b = (brand || '').trim();
  if (!b) return brand;
  const m = b.match(/^([a-z0-9][a-z0-9-]*)\.(com|co|net|org|shop|store|us|io)\b.*$/i);
  if (!m) return b;
  const root = m[1];
  return root === root.toLowerCase() ? root.charAt(0).toUpperCase() + root.slice(1) : root;
}
