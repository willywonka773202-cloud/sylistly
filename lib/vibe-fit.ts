import type { Category, Product } from '@/lib/types';
import type { GeneratorFrame, VibeId } from '@/lib/vibes';

/**
 * Runtime vibe-appropriateness gate — mirrors the generator's type rules so the
 * builder's slot-fill FALLBACK (the keyword composer / search) can't drop an
 * off-vibe piece onto the board (e.g. a denim trucker or jeans into a gym fit).
 * Returns false only for clear, high-confidence mismatches — when unsure, allow.
 */
const nameOf = (p: Product) => `${p.brand || ''} ${p.name || ''}`.toLowerCase();

const GYM_BOTTOM_OK = /legging|short|jogger|sweatpant|track|tight|\bbike|running|active/;
const GYM_BOTTOM_NO = /jean|trouser|cargo|suit|chino|dress pant|skirt|denim|pleated|corduroy|wide leg/;
const GYM_TOP_OK = /tee|t-shirt|tank|jersey|sports bra|hoodie|sweatshirt|crew|base layer|active|sport|\bzip|performance/;
const GYM_TOP_NO = /blouse|button[- ]?up|button[- ]?down|\bpolo|cardigan|dress shirt|halter|oxford|flannel/;
const GYM_OUTER_NO = /denim|trucker|coach|blazer|\bsuit|leather|wool|peacoat|barn|chore|overshirt|flannel/;
const ATHLETIC_SHOE = /jordan|air max|\bdunk|air force|af1|samba|gazelle|campus|new balance|\bnb\b|trainer|runner|running|\bgel|metcon|pegasus|ultraboost|vapor|react|\b\d{3,4}\b|nike|adidas|asics|hoka|brooks|reebok|\bpuma|on cloud|salomon|recovery/;

const FORMAL_GARMENT_NO = /hoodie|sweatpant|jogger|cargo|legging|sports bra|\bjersey\b|track pant|athletic short|board ?short|sweat short|bike short/;
const LOUD_ATHLETIC_SHOE = /jordan|air max|\bdunk|metcon|cleat|\bgel|pegasus|running/;

export function isVibeAppropriate(product: Product, vibe: VibeId | string, slot: Category): boolean {
  const n = nameOf(product);

  if (vibe === 'gym') {
    if (slot === 'bottom') return GYM_BOTTOM_OK.test(n) && !GYM_BOTTOM_NO.test(n);
    if (slot === 'top') return GYM_TOP_OK.test(n) && !GYM_TOP_NO.test(n);
    if (slot === 'outer') return !GYM_OUTER_NO.test(n);
    if (slot === 'shoes') return ATHLETIC_SHOE.test(n);
    return true;
  }

  // Dressy / professional vibes reject overtly athletic or casual-lounge garments.
  if (vibe === 'office' || vibe === 'date' || vibe === 'night' || vibe === 'preppy') {
    if ((slot === 'top' || slot === 'bottom') && FORMAL_GARMENT_NO.test(n)) return false;
    if (slot === 'shoes' && (vibe === 'office' || vibe === 'night') && LOUD_ATHLETIC_SHOE.test(n)) return false;
  }

  return true;
}

/** Convenience: drop off-vibe products from a candidate list. */
export function filterVibeAppropriate(products: Product[], vibe: VibeId | string, slot: Category): Product[] {
  return products.filter((product) => isVibeAppropriate(product, vibe, slot));
}

// Keep the import surface honest for callers that already pass a frame around.
export type { GeneratorFrame };
