import type { Category, Product } from './types';

/** Stable product code used in public look URLs. This module intentionally has
 * no catalog import so client surfaces can create a share link without pulling
 * the full shopping inventory into their first-load bundle. */
export function productShareCode(productId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < productId.length; index += 1) {
    hash ^= productId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const REQUIRED_SHARE_CATEGORIES: Category[] = ['top', 'bottom', 'shoes'];

/** Encode a complete composed fit into a share slug (`c-…`). Device-local
 * `owned-*` anchors cannot be resolved by a recipient, so reject the whole
 * share instead of silently publishing a different/partial outfit. */
export function encodeLookSlug(items: Partial<Record<Category, Product>>): string | null {
  if (!REQUIRED_SHARE_CATEGORIES.every((category) => Boolean(items[category]?.id))) return null;
  const products = Object.values(items).filter((product): product is Product => Boolean(product?.id));
  if (products.some((product) => product.id.startsWith('owned-'))) return null;
  const codes = products.map((product) => productShareCode(product.id));
  return `c-${codes.join('.')}`;
}
