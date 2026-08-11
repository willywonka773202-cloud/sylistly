import type { Category, Product } from './types';

export const REQUIRED_SHARE_CATEGORIES: Category[] = ['top', 'bottom', 'shoes'];

/** Catalog-agnostic strict decoder. The caller supplies the current catalog
 * lookup, making the fail-closed composition contract independently testable. */
export function decodeCompleteLookSlug(
  slug: string,
  resolveCode: (code: string) => Product | undefined,
): Partial<Record<Category, Product>> | null {
  if (!slug.startsWith('c-')) return null;
  const codes = slug.slice(2).split('.');
  if (codes.length < REQUIRED_SHARE_CATEGORIES.length || codes.length > 10 || codes.some((code) => !code)) {
    return null;
  }
  const items: Partial<Record<Category, Product>> = {};
  for (const code of codes) {
    const product = resolveCode(code);
    if (!product || product.id.startsWith('owned-') || items[product.category]) return null;
    items[product.category] = product;
  }
  return REQUIRED_SHARE_CATEGORIES.every((category) => Boolean(items[category])) ? items : null;
}
