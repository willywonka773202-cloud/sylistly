import { NextRequest, NextResponse } from 'next/server';
import { wrapAffiliate } from '@/lib/affiliate';
import catalogHealthData from '@/data/catalog-health.json';
import { isProductPublishable, type CatalogHealthSnapshot } from '@/lib/catalog-publishability';
import { recordRetailerClick } from '@/lib/click-ledger';
import { hasExactProductLink } from '@/lib/product-image-quality';
import { getProductOutboundUrl } from '@/lib/product-links';
import { resolveProductById } from '@/lib/product-resolution';
import {
  affiliateNetworkForUrl,
  buildAffiliateSubId,
  sanitizeAnalyticsIdentity,
  sanitizeAttributionToken,
  validateRetailerDestination,
  type RetailerAttribution,
} from '@/lib/retailer-attribution';
import { captureServerAnalytics } from '@/lib/server-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLISHABILITY_OPTIONS = {
  health: catalogHealthData as CatalogHealthSnapshot,
  freshnessPolicy: 'require-fresh' as const,
};

function safeError(error: string, status: number) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
        'x-robots-tag': 'noindex, nofollow',
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const productId = sanitizeAttributionToken(request.nextUrl.searchParams.get('product'), 180);
  const lookId = sanitizeAttributionToken(request.nextUrl.searchParams.get('look'));
  const surface = sanitizeAttributionToken(request.nextUrl.searchParams.get('surface')) || 'unknown';
  const campaign = sanitizeAttributionToken(request.nextUrl.searchParams.get('campaign')) || 'organic';
  const subId = sanitizeAttributionToken(request.nextUrl.searchParams.get('sub'), 180);
  const anonymousId = sanitizeAnalyticsIdentity(request.nextUrl.searchParams.get('aid'), 'a');
  const sessionId = sanitizeAnalyticsIdentity(request.nextUrl.searchParams.get('sid'), 's');
  const distinctId = anonymousId || sessionId || `click_${crypto.randomUUID()}`;

  if (!productId) {
    await captureServerAnalytics('affiliate_redirect_failed', distinctId, {
      anonymous_id: anonymousId || null,
      anonymous_session_id: sessionId || null,
      surface,
      campaign,
      error_code: 'invalid_product_id',
    });
    return safeError('invalid_product_id', 400);
  }

  const resolved = await resolveProductById(productId);
  if (!resolved) {
    await Promise.allSettled([
      recordRetailerClick({
        productId,
        surface,
        campaign,
        subId,
        anonymousId,
        sessionId,
        redirectStatus: 'failure',
        errorCode: 'product_not_found',
      }),
      captureServerAnalytics('affiliate_redirect_failed', distinctId, {
        anonymous_id: anonymousId || null,
        anonymous_session_id: sessionId || null,
        product_id: productId,
        look_id: lookId,
        surface,
        campaign,
        error_code: 'product_not_found',
      }),
    ]);
    return safeError('product_not_found', 404);
  }

  const productUnavailable = !isProductPublishable(resolved.product, PUBLISHABILITY_OPTIONS);
  const exactProductLink = hasExactProductLink(resolved.product);
  const validation = validateRetailerDestination(getProductOutboundUrl(resolved.product));
  if (productUnavailable || !exactProductLink || !validation.ok || !validation.url || !validation.host) {
    const errorCode = productUnavailable
      ? 'product_unavailable'
      : !exactProductLink
        ? 'non_exact_destination'
        : validation.error || 'invalid_destination';
    await Promise.allSettled([
      recordRetailerClick({
        productId,
        productSource: resolved.source,
        lookId,
        surface,
        campaign,
        subId,
        anonymousId,
        sessionId,
        redirectStatus: 'failure',
        errorCode,
      }),
      captureServerAnalytics('affiliate_redirect_failed', distinctId, {
        anonymous_id: anonymousId || null,
        anonymous_session_id: sessionId || null,
        product_id: productId,
        look_id: lookId,
        surface,
        campaign,
        error_code: errorCode,
      }),
    ]);
    return safeError('invalid_destination', 422);
  }

  const attribution: RetailerAttribution = {
    productId,
    lookId,
    surface,
    campaign,
    subId: subId || productId,
    anonymousId,
    sessionId,
  };
  const networkSubId = buildAffiliateSubId(attribution);
  const redirectUrl = wrapAffiliate(validation.url, networkSubId);
  const affiliateNetwork = affiliateNetworkForUrl(redirectUrl, validation.url);

  await Promise.allSettled([
    recordRetailerClick({
      productId,
      productSource: resolved.source,
      lookId,
      surface,
      campaign,
      subId: attribution.subId,
      networkSubId,
      anonymousId,
      sessionId,
      destinationHost: validation.host,
      affiliateNetwork,
      redirectStatus: 'success',
    }),
    captureServerAnalytics('affiliate_redirect_succeeded', distinctId, {
      anonymous_id: anonymousId || null,
      anonymous_session_id: sessionId || null,
      product_id: productId,
      look_id: lookId,
      surface,
      campaign,
      sub_id: networkSubId,
      requested_sub_id: attribution.subId,
      destination_host: validation.host,
      affiliate_network: affiliateNetwork,
    }),
  ]);

  return NextResponse.redirect(redirectUrl, {
    status: 307,
    headers: {
      'cache-control': 'private, no-store, max-age=0',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
