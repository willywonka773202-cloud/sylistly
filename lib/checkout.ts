import type { CheckoutProduct } from '@/components/CheckoutSheet';

export interface RetailerGroup {
  retailer: string;
  products: CheckoutProduct[];
}

export function formatCheckoutPrice(priceCents?: number): string {
  if (!priceCents) return 'Price pending';
  return `$${(priceCents / 100).toLocaleString('en-US')}`;
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

export function openCheckoutUrls(urls: string[]): {
  openedCount: number;
  requestedCount: number;
} {
  if (typeof window === 'undefined') {
    return { openedCount: 0, requestedCount: 0 };
  }

  const uniqueUrls = Array.from(
    new Set(urls.filter((url) => typeof url === 'string' && url.trim())),
  );
  const openedWindows: Window[] = [];

  for (let index = 0; index < uniqueUrls.length; index += 1) {
    const popup = window.open('about:blank', `sylistly_checkout_${Date.now()}_${index}`);
    if (!popup) break;
    openedWindows.push(popup);
  }

  openedWindows.forEach((popup, index) => {
    try {
      popup.opener = null;
      popup.location.replace(uniqueUrls[index]);
    } catch {
      popup.close();
    }
  });

  return {
    openedCount: openedWindows.length,
    requestedCount: uniqueUrls.length,
  };
}
