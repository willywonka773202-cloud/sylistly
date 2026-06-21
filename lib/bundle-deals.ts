import type { Product } from './types';

/**
 * Bundle "& save" pricing — HONEST by construction.
 *
 * Sylistly links out to retailers, so it can't change a retailer's price. The
 * only truthful way to make a bundle cheaper is to surface a REAL offer the user
 * redeems at that retailer. Most retailer perks are NOT shared pasteable codes —
 * they're first-order signup offers (a single-use code emailed to YOU) or
 * verification-gated (student/military via SheerID). So we model `redeem` and
 * frame savings as "up to $X" with a clear how-to, never a fake guaranteed code.
 * Only `verified: true` offers are ever shown/counted; an empty registry ⇒ the
 * bundle shows its honest full total and no discount. Streetwear/cult brands
 * (Kith, Aime Leon Dore, Telfar, Stussy) genuinely don't run public discounts —
 * we leave them at full price rather than invent codes.
 */
export interface RetailerDeal {
  /** Case-insensitive substring matched against product.retailer. */
  retailer: string;
  kind: 'percent' | 'fixed';
  /** percent: 0–100. fixed: cents off the retailer subtotal. */
  value: number;
  label: string;
  /** How the user actually gets it. */
  redeem: 'signup' | 'verify' | 'code';
  /** Only for redeem:'code' (a genuinely public shared code). */
  code?: string;
  /** Where to sign up / verify. */
  url?: string;
  /** Gate: unverified offers are NEVER displayed or counted. */
  verified: boolean;
}

// Sourced + sanity-checked June 2026 (see HANDOFF / [[sylistly-bundle-deals]]).
// HIGH-confidence, official: adidas, Everlane (first-order signup); Nike,
// lululemon (verify student/military). MED-confidence kept verified:false until
// the exact % is confirmed. Streetwear brands intentionally omitted.
export const RETAILER_DEALS: RetailerDeal[] = [
  { retailer: 'adidas', kind: 'percent', value: 15, label: '15% off your first order', redeem: 'signup', url: 'https://www.adidas.com', verified: true },
  { retailer: 'Everlane', kind: 'percent', value: 20, label: '20% off your first order', redeem: 'signup', url: 'https://www.everlane.com', verified: true },
  { retailer: 'Nike', kind: 'percent', value: 10, label: '10% off — students, military & first responders', redeem: 'verify', url: 'https://www.nike.com/help/a/student-discount', verified: true },
  // Merchology: held back (verified:false) — the prior entry's URL pointed at
  // NIKE's discount page (copy-paste error) which would misdirect users.
  // Re-enable only with Merchology's own confirmed offer % + redemption URL.
  { retailer: 'Merchology', kind: 'percent', value: 10, label: '10% off — students, military & first responders', redeem: 'verify', url: 'https://www.merchology.com', verified: false },
  { retailer: 'lululemon', kind: 'percent', value: 15, label: '15% off — military & first responders', redeem: 'verify', url: 'https://shop.lululemon.com/help/programs-and-discounts', verified: true },
  // MED-confidence — confirm the live % then flip verified:true:
  { retailer: 'SKIMS', kind: 'percent', value: 15, label: '~15% off your first order', redeem: 'signup', url: 'https://skims.com', verified: false },
  { retailer: 'Bodega', kind: 'percent', value: 10, label: '~10% off your first order', redeem: 'signup', url: 'https://bdgastore.com', verified: false },
  { retailer: 'Local Eclectic', kind: 'percent', value: 10, label: '10% off your first order', redeem: 'signup', url: 'https://www.localeclectic.com', verified: false },
  { retailer: 'H&M', kind: 'percent', value: 10, label: '10% off your first purchase', redeem: 'signup', url: 'https://www2.hm.com', verified: false },
];

export interface BundleOffer {
  retailer: string;
  label: string;
  redeem: 'signup' | 'verify' | 'code';
  code?: string;
  url?: string;
  savingsCents: number;
}

export interface BundleDeal {
  /** Honest sum of every piece's price. */
  retailCents: number;
  /** What you'd pay after the offers (the "up to" floor). */
  dealCents: number;
  /** Max savings if you redeem every offer. */
  savingsCents: number;
  /** Rounded % off, 0 when there's no verified offer. */
  pct: number;
  offers: BundleOffer[];
  hasDeal: boolean;
}

/**
 * Group pieces by retailer, apply each retailer's verified offer to that
 * retailer's subtotal (an offer applies once per cart, not per item), sum the
 * real "up to" savings.
 */
export function computeBundleDeal(products: Product[]): BundleDeal {
  const retailCents = products.reduce((sum, product) => sum + (product.priceCents || 0), 0);

  const subtotals = new Map<string, number>(); // lowercased retailer → subtotal
  for (const product of products) {
    const key = (product.retailer || '').toLowerCase().trim();
    if (!key) continue;
    subtotals.set(key, (subtotals.get(key) || 0) + (product.priceCents || 0));
  }

  const offers: BundleOffer[] = [];
  let savingsCents = 0;
  for (const [key, subtotal] of subtotals) {
    const deal = RETAILER_DEALS.find((d) => d.verified && key.includes(d.retailer.toLowerCase()));
    if (!deal) continue;
    const save =
      deal.kind === 'percent'
        ? Math.round((subtotal * deal.value) / 100)
        : Math.min(deal.value, subtotal);
    if (save <= 0) continue;
    savingsCents += save;
    offers.push({
      retailer: deal.retailer,
      label: deal.label,
      redeem: deal.redeem,
      code: deal.code,
      url: deal.url,
      savingsCents: save,
    });
  }

  offers.sort((a, b) => b.savingsCents - a.savingsCents);
  const dealCents = Math.max(0, retailCents - savingsCents);
  const pct = retailCents > 0 ? Math.round((savingsCents / retailCents) * 100) : 0;
  return { retailCents, dealCents, savingsCents, pct, offers, hasDeal: savingsCents > 0 };
}
