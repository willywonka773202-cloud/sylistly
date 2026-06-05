import { getFeaturedCatalogProducts } from '@/lib/catalog';
import {
  hasProductCommerceLink,
  hasExactProductLink,
  isEditorialCutoutProduct,
  isMultiItemSetProduct,
  sortTransparentFeedRenderableProducts,
} from '@/lib/product-image-quality';
import { CATEGORY_ORDER, type Category, type Product } from '@/lib/types';

const STYLIST_CATALOG_LIMIT = 240;
const CATEGORY_PREVIEW_LIMIT = 80;
const GENERAL_PREVIEW_LIMIT = 600;
const STARTER_CATEGORY_ORDER: Category[] = ['top', 'outer', 'bottom', 'shoes', 'bag', 'hat', 'eyewear', 'jewelry'];

export function isCleanStylistCatalogProduct(product: Product): boolean {
  return Boolean(
    isEditorialCutoutProduct(product)
      && hasProductCommerceLink(product)
      && hasExactProductLink(product)
      && !isMultiItemSetProduct(product)
  );
}

export function getStylistCatalogProducts(): Product[] {
  const byId = new Map<string, Product>();

  for (const product of [
    ...CATEGORY_ORDER.flatMap((category) => getFeaturedCatalogProducts(CATEGORY_PREVIEW_LIMIT, category)),
    ...getFeaturedCatalogProducts(GENERAL_PREVIEW_LIMIT),
  ]) {
    byId.set(product.id, product);
  }

  return sortTransparentFeedRenderableProducts(Array.from(byId.values()))
    .filter(isCleanStylistCatalogProduct)
    .slice(0, STYLIST_CATALOG_LIMIT);
}

export function getStylistStarterProducts(limit = 8): Product[] {
  const products = getStylistCatalogProducts();
  const selected: Product[] = [];
  const usedIds = new Set<string>();

  for (const category of STARTER_CATEGORY_ORDER) {
    const product = products.find((candidate) => candidate.category === category && !usedIds.has(candidate.id));
    if (!product) continue;
    selected.push(product);
    usedIds.add(product.id);
    if (selected.length >= limit) return selected;
  }

  for (const product of products) {
    if (usedIds.has(product.id)) continue;
    selected.push(product);
    usedIds.add(product.id);
    if (selected.length >= limit) break;
  }

  return selected;
}
