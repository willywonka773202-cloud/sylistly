import {
  CLIENT_CATALOG_PRODUCTS,
  isBuyableClientCatalogProduct,
} from '@/lib/client-catalog';
import type { Product } from '@/lib/types';

export interface CatalogFacets {
  brands: string[];
  retailers: string[];
  colors: string[];
}

export function getPublishedCatalogProducts(): Product[] {
  return CLIENT_CATALOG_PRODUCTS.filter(isBuyableClientCatalogProduct);
}

export function buildCatalogFacets(products = getPublishedCatalogProducts()): CatalogFacets {
  const brands = new Set<string>();
  const retailers = new Set<string>();
  const colors = new Set<string>();
  for (const product of products) {
    if (product.brand) brands.add(product.brand);
    if (product.retailer) retailers.add(product.retailer);
    for (const color of product.colors || []) {
      if (color.trim()) colors.add(color.trim());
    }
  }
  const alpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  return {
    brands: Array.from(brands).sort(alpha),
    retailers: Array.from(retailers).sort(alpha),
    colors: Array.from(colors).sort(alpha).slice(0, 40),
  };
}
