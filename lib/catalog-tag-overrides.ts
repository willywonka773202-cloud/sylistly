import catalogTagOverridesData from '../data/catalog-tag-overrides.json';
import type { Product } from './types';

export interface CatalogTagOverride {
  vibes?: string[];
  occasions?: string[];
  searchTerms?: string[];
  gender?: Array<'masc' | 'fem' | 'androgynous'>;
}

const catalogTagOverrides = catalogTagOverridesData as Record<string, CatalogTagOverride>;

function uniqueStrings(...groups: Array<string[] | undefined>): string[] {
  return Array.from(new Set(groups.flatMap((group) => group || []).filter((value) => typeof value === 'string' && value.trim())));
}

function metadataList(product: Product, key: string): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function applyCatalogTagOverrides(product: Product): Product {
  const override = catalogTagOverrides[product.id];
  if (!override) return product;

  const vibes = uniqueStrings(product.vibes, metadataList(product, 'vibes'), metadataList(product, 'styles'), override.vibes);
  const occasions = uniqueStrings(product.occasions, metadataList(product, 'occasions'), override.occasions);
  const searchTerms = uniqueStrings(product.searchTerms, metadataList(product, 'searchTerms'), metadataList(product, 'keywords'), override.searchTerms);
  const genderSource = override.gender?.length ? override.gender : uniqueStrings(product.gender, metadataList(product, 'gender'));
  const gender = uniqueStrings(genderSource)
    .filter((tag): tag is 'masc' | 'fem' | 'androgynous' => tag === 'masc' || tag === 'fem' || tag === 'androgynous');

  return {
    ...product,
    vibes,
    occasions,
    searchTerms,
    gender,
    metadata: {
      ...(product.metadata || {}),
      vibes,
      styles: vibes,
      occasions,
      searchTerms,
      keywords: searchTerms,
      gender,
      tagOverride: true,
    },
  };
}

export function applyCatalogTagOverridesToProducts(products: Product[]): Product[] {
  return products.map(applyCatalogTagOverrides);
}
