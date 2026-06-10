/**
 * Compact, stable share codes for catalog products — lets any composed fit
 * become a URL without a database: /look/c-<code>.<code>.<code>...
 * Codes are content-hashes of product ids, so links survive catalog
 * reordering (they only die if the product itself is removed).
 */
import { CLIENT_CATALOG_PRODUCTS } from '@/lib/client-catalog';
import type { Category, Product } from '@/lib/types';

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const CODE_TO_PRODUCT = new Map<string, Product>();
const ID_TO_CODE = new Map<string, string>();
for (const product of CLIENT_CATALOG_PRODUCTS) {
  let code = fnv1a(product.id).toString(36);
  while (CODE_TO_PRODUCT.has(code)) code += 'x'; // collision shield (vanishingly rare)
  CODE_TO_PRODUCT.set(code, product);
  ID_TO_CODE.set(product.id, code);
}

/** Encode a composed fit into a share slug ('c-…'); null below 3 pieces. */
export function encodeLookSlug(items: Partial<Record<Category, Product>>): string | null {
  const codes = Object.values(items)
    .filter((product): product is Product => Boolean(product))
    .map((product) => ID_TO_CODE.get(product.id))
    .filter((code): code is string => Boolean(code));
  if (codes.length < 3) return null;
  return `c-${codes.join('.')}`;
}

/** Decode a 'c-…' slug back into products; null when too few survive. */
export function decodeLookSlug(slug: string): Partial<Record<Category, Product>> | null {
  if (!slug.startsWith('c-')) return null;
  const items: Partial<Record<Category, Product>> = {};
  for (const code of slug.slice(2).split('.').slice(0, 10)) {
    const product = CODE_TO_PRODUCT.get(code);
    if (product && !items[product.category]) items[product.category] = product;
  }
  return Object.keys(items).length >= 3 ? items : null;
}
