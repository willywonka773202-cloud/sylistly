import type { CheckoutProduct } from '@/components/CheckoutSheet';

export interface RetailerGroup {
  retailer: string;
  products: CheckoutProduct[];
}

export function formatCheckoutPrice(priceCents?: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString()}`;
}

export function buildRetailerGroups(products: CheckoutProduct[]): RetailerGroup[] {
  const groups = new Map<string, CheckoutProduct[]>();

  for (const product of products) {
    const key = product.retailer || 'Retailer';
    const current = groups.get(key) || [];
    current.push(product);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([retailer, groupedProducts]) => ({
    retailer,
    products: groupedProducts,
  }));
}

export function isExactProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const params = parsed.searchParams;

    if (!pathname || pathname === '/') return false;
    if (pathname.includes('/search') || pathname.includes('/s/')) return false;
    if (pathname.includes('search-result')) return false;
    if (params.has('q') || params.has('query') || params.has('search') || params.has('searchTerm') || params.has('text') || params.has('keyword')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
