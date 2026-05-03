import generatedCatalogData from '../data/generated-catalog.json';
import type { Product } from './types';

type GeneratedCatalogProduct = Product & {
  metadata?: Product['metadata'] & {
    source?: 'generated_catalog';
    sourceQuery?: string;
    colors?: string[];
    styles?: string[];
    vibes?: string[];
    occasions?: string[];
    gender?: string[];
    keywords?: string[];
    searchTerms?: string[];
    imageQuality?: 'good' | 'ok' | 'missing';
    popularityScore?: number;
  };
};

export const GENERATED_CATALOG_PRODUCTS: Product[] = (generatedCatalogData as GeneratedCatalogProduct[]).map(
  (product) => ({
    ...product,
    metadata: {
      source: 'generated_catalog',
      ...(product.metadata || {}),
    },
  }),
);
