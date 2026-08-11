/**
 * Compact, stable share codes for catalog products — lets any composed fit
 * become a URL without a database: /look/c-<code>.<code>.<code>...
 * Codes are content-hashes of product ids, so links survive catalog
 * reordering (they only die if the product itself is removed).
 */
import { CLIENT_CATALOG_PRODUCTS } from '@/lib/client-catalog';
import { decodeCompleteLookSlug } from '@/lib/share-code-contract';
import { productShareCode } from '@/lib/share-code-encode';
import type { Category, Product } from '@/lib/types';

const CODE_TO_PRODUCT = new Map<string, Product>();
for (const product of CLIENT_CATALOG_PRODUCTS) {
  const code = productShareCode(product.id);
  // A collision would make a client-created URL ambiguous. Fail the build
  // instead of silently publishing a share link that resolves to another item.
  if (CODE_TO_PRODUCT.has(code)) {
    throw new Error(`Catalog share-code collision for ${product.id}`);
  }
  CODE_TO_PRODUCT.set(code, product);
}

export { encodeLookSlug } from '@/lib/share-code-encode';

/** Decode a `c-…` slug back into an exact, complete composition. Unknown
 * codes and duplicate categories fail closed: accepting the surviving subset
 * would misrepresent a retired or device-local piece as the original look. */
export function decodeLookSlug(slug: string): Partial<Record<Category, Product>> | null {
  return decodeCompleteLookSlug(slug, (code) => CODE_TO_PRODUCT.get(code));
}
