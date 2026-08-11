import { NextRequest, NextResponse } from 'next/server';
import catalogHealthData from '@/data/catalog-health.json';
import { isProductPublishable, type CatalogHealthSnapshot } from '@/lib/catalog-publishability';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { resolveProductsByIds } from '@/lib/product-resolution';
import {
  buildRetailerClickPath,
  sanitizeAnalyticsIdentity,
  sanitizeAttributionToken,
} from '@/lib/retailer-attribution';
import { supabaseServer } from '@/lib/supabase';

export const runtime = 'nodejs';

const PUBLISHABILITY_OPTIONS = {
  health: catalogHealthData as CatalogHealthSnapshot,
  freshnessPolicy: 'require-fresh' as const,
};

interface ShopAllBody {
  fitId?: string;
  productIds?: string[];
  subIds?: Record<string, string>;
  attribution?: {
    lookId?: string;
    surface?: string;
    campaign?: string;
    anonymousId?: string;
    sessionId?: string;
  };
}

function productIdsFromFitItems(items: unknown): string[] {
  if (!items || typeof items !== 'object') return [];
  return Object.values(items as Record<string, unknown>).flatMap((value) => {
    if (typeof value === 'string') return [value];
    if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
      return [(value as { id: string }).id];
    }
    return [];
  });
}

function cleanIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(
    values
      .map((value) => sanitizeAttributionToken(value, 180))
      .filter((value): value is string => Boolean(value)),
  )).slice(0, 32);
}

export async function POST(request: NextRequest) {
  let body: ShopAllBody;
  try {
    body = (await request.json()) as ShopAllBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const fitId = sanitizeAttributionToken(body.fitId, 96);
  let ids = cleanIds(body.productIds);

  if (fitId && !ids.length) {
    const hasSupabase = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
      && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    );
    if (!hasSupabase) {
      return NextResponse.json({ error: 'fit_store_unavailable' }, { status: 503 });
    }
    try {
      const supabase = await supabaseServer();
      const { data: fit, error } = await supabase.from('fits').select('items').eq('id', fitId).single();
      if (error || !fit) return NextResponse.json({ error: 'fit_not_found' }, { status: 404 });
      ids = cleanIds(productIdsFromFitItems(fit.items));
    } catch {
      return NextResponse.json({ error: 'fit_store_unavailable' }, { status: 503 });
    }
  }

  if (!ids.length) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const resolved = await resolveProductsByIds(ids);
  const resolvedIds = new Set(resolved.map(({ product }) => product.id));
  const missingProductIds = ids.filter((id) => !resolvedIds.has(id));
  const buyable = resolved.filter(({ product }) => (
    isProductPublishable(product, PUBLISHABILITY_OPTIONS)
    && hasExactProductLink(product)
  ));
  const buyableIds = new Set(buyable.map(({ product }) => product.id));
  const withheldProductIds = ids.filter((id) => resolvedIds.has(id) && !buyableIds.has(id));
  const lookId = sanitizeAttributionToken(body.attribution?.lookId || fitId);
  const surface = sanitizeAttributionToken(body.attribution?.surface) || 'shop-all';
  const campaign = sanitizeAttributionToken(body.attribution?.campaign) || 'organic';
  const anonymousId = sanitizeAnalyticsIdentity(body.attribution?.anonymousId, 'a');
  const sessionId = sanitizeAnalyticsIdentity(body.attribution?.sessionId, 's');

  const links = buyable.map(({ product }) => {
    const requestedSubId = body.subIds?.[product.id];
    const subId = sanitizeAttributionToken(requestedSubId, 180) || product.id;
    return {
      productId: product.id,
      subId,
      url: buildRetailerClickPath({
        productId: product.id,
        lookId,
        surface,
        campaign,
        subId,
        anonymousId,
        sessionId,
      }),
    };
  });

  return NextResponse.json({
    // Compatibility for the pre-existing response field. These are now safe
    // first-party redirect URLs; the server applies the affiliate wrapper.
    affiliateUrls: links.map((link) => link.url),
    redirectUrls: links.map((link) => link.url),
    links,
    products: buyable.map(({ product }) => product),
    missingProductIds,
    withheldProductIds,
  });
}
