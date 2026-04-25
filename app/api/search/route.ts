import { NextRequest, NextResponse } from 'next/server';
import { mockSearch } from '@/lib/mock-products';
import { searchBrandCatalog } from '@/lib/brand-catalog';
import { searchPhotoCatalog } from '@/lib/photo-catalog';
import type { Category, Product } from '@/lib/types';
import { getFeaturedCatalogProducts } from '@/lib/catalog';

export const runtime = 'nodejs';

interface SearchBody {
  query: string;
  category?: Category;
  gender?: 'masc' | 'fem' | 'unisex';
  mode?: 'live' | 'demo';
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SearchBody;
  const query = (body.query || '').slice(0, 200);
  const category = body.category;
  
  try {
    // 1. Check for empty query but a selected category (featured items)
    if (!query.trim() && category) {
      const featuredCatalogProducts = getFeaturedCatalogProducts(6, category);
      if (featuredCatalogProducts.length > 0) {
          return NextResponse.json({
            products: featuredCatalogProducts,
            source: 'catalog'
          });
      }
    }

    // 2. Search local photo catalog
    const photoCatalogProducts = searchPhotoCatalog({ category: category || 'top' } as any, query);
    if (photoCatalogProducts.length > 0) {
      return NextResponse.json({ 
        products: photoCatalogProducts.slice(0, 6), 
        source: 'catalog' 
      });
    }

    // 3. Search brand catalog
    const brandedCatalogProducts = searchBrandCatalog({ category: category || 'top' } as any, query);
    if (brandedCatalogProducts.length > 0) {
      return NextResponse.json({ 
        products: brandedCatalogProducts.slice(0, 6), 
        source: 'catalog' 
      });
    }

    // 4. Fallback to mock search
    const mockProducts = mockSearch(category || 'top', query, body.gender || 'unisex');
    if (mockProducts.length > 0) {
      return NextResponse.json({
        products: mockProducts.slice(0, 6),
        mock: true,
        mode: 'demo',
        source: 'catalog'
      });
    }

    return NextResponse.json(
      { error: 'No products found for that query yet.', source: 'catalog' },
      { status: 404 },
    );
  } catch (err) {
    console.error('[api/search]', err);
    return NextResponse.json(
      { error: 'Database search failed. Please try again.' },
      { status: 500 },
    );
  }
}
