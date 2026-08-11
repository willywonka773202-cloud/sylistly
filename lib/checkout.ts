import { wrapAffiliate } from '@/lib/affiliate';
import { buildRetailerClickPath, validateRetailerDestination } from '@/lib/retailer-attribution';
import type { CheckoutProduct } from '@/components/CheckoutSheet';

export interface RetailerGroup {
  retailer: string;
  products: CheckoutProduct[];
}

/** `owned-*` rows are transient anchors the user already has, not catalog
 * inventory resolvable by `/api/out`. They stay visible in the look but must
 * never be presented as another item to purchase. */
export function isOwnedCheckoutProductId(productId: unknown): boolean {
  return typeof productId === 'string' && productId.startsWith('owned-');
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
    const destination = validateRetailerDestination(url);
    if (!destination.ok || !destination.url) return false;
    const parsed = new URL(destination.url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase();
    const params = parsed.searchParams;
    const isNordstromProductPath =
      (hostname === 'nordstrom.com' || hostname === 'nordstromrack.com') &&
      /^\/s\/[^/]+\/\d+/.test(pathname);

    if (!pathname || pathname === '/') return false;
    if (pathname.includes('/search') || (pathname.includes('/s/') && !isNordstromProductPath)) return false;
    if (pathname.includes('search-result')) return false;
    if (params.has('q') || params.has('query') || params.has('search') || params.has('searchTerm') || params.has('text') || params.has('keyword')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function getCheckoutUrlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'merchant link';
  }
}

export interface CheckoutOpenTarget {
  productId?: string;
  url: string;
  subId?: string;
  lookId?: string;
}

export function openCheckoutUrls(
  targets: Array<string | CheckoutOpenTarget>,
  surface = 'checkout-batch',
): {
  openedCount: number;
  requestedCount: number;
} {
  if (typeof window === 'undefined') {
    return { openedCount: 0, requestedCount: 0 };
  }

  const normalizedTargets = targets.flatMap((target): CheckoutOpenTarget[] => {
    const value = typeof target === 'string' ? target.trim() : target.url?.trim();
    if (!value) return [];
    const destination = validateRetailerDestination(value);
    if (!destination.ok || !destination.url) return [];
    return typeof target === 'string'
      ? [{ url: destination.url }]
      : [{ ...target, url: destination.url }];
  });
  const uniqueTargets = Array.from(
    new Map(normalizedTargets.map((target) => [target.productId || target.url, target])).values(),
  );
  const openedWindows: Window[] = [];

  for (let index = 0; index < uniqueTargets.length; index += 1) {
    const popup = window.open('about:blank', `sylistly_checkout_${Date.now()}_${index}`);
    if (!popup) break;
    openedWindows.push(popup);
  }

  openedWindows.forEach((popup, index) => {
    try {
      const target = uniqueTargets[index];
      popup.opener = null;
      popup.location.replace(target.productId
        ? buildRetailerClickPath({
          productId: target.productId,
          lookId: target.lookId,
          surface,
          subId: target.subId || target.productId,
        })
        : wrapAffiliate(target.url));
    } catch {
      popup.close();
    }
  });

  return {
    openedCount: openedWindows.length,
    requestedCount: uniqueTargets.length,
  };
}
