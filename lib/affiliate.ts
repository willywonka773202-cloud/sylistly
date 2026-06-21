/**
 * Wrap raw retailer URLs with affiliate tracking.
 * - Skimlinks auto-affiliates any outbound URL via a redirect service.
 * - Rakuten is preferred for partnered brands (higher commission, cleaner attribution).
 *
 * Resolution order:
 *  1. Known Rakuten-partnered retailer → Rakuten deep link
 *  2. Otherwise → Skimlinks redirect
 *  3. Fallback → raw URL (for local dev without keys)
 */

const RAKUTEN_PARTNERS: Record<string, string> = {
  // retailerHost -> Rakuten advertiserId (placeholder — fill from your Rakuten dashboard)
  'nordstrom.com': '__RAKUTEN_ID_NORDSTROM__',
  'shopbop.com':   '__RAKUTEN_ID_SHOPBOP__',
  'revolve.com':   '__RAKUTEN_ID_REVOLVE__',
  'endclothing.com': '__RAKUTEN_ID_END__',
  'ssense.com':    '__RAKUTEN_ID_SSENSE__',
};

// Publisher/affiliate IDs are NOT secret (they ship in the redirect URL on every
// affiliate site), so read the NEXT_PUBLIC_ vars first — this is what lets the
// wrapping work in client components. Server-only vars are kept as a fallback.
function skimlinksId(): string | undefined {
  return process.env.NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID?.trim() || process.env.SKIMLINKS_PUBLISHER_ID?.trim();
}
function rakutenAffiliateId(): string | undefined {
  return process.env.NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID?.trim() || process.env.RAKUTEN_AFFILIATE_ID?.trim();
}

/**
 * Wrap a raw retailer URL with affiliate tracking. `subId` (e.g. a product id)
 * is passed through as the network's per-click custom tracking token — Skimlinks
 * `xcust`, Rakuten `u1` — so once the keys are live you get CONVERSION
 * ATTRIBUTION (which product/look actually drove the sale). Optional + appended
 * only when present, so existing callers and links are unchanged.
 */
export function wrapAffiliate(url: string, subId?: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return url;
    const host = u.hostname.replace(/^www\./, '');
    const sub = subId ? subId.trim() : '';

    const rakutenId = Object.entries(RAKUTEN_PARTNERS).find(([domain]) => host.endsWith(domain))?.[1];
    const rakutenAffiliate = rakutenAffiliateId();
    // Skip placeholder advertiser IDs (still '__...__') so we don't emit broken links.
    if (rakutenId && !rakutenId.startsWith('__') && rakutenAffiliate) {
      return (
        `https://click.linksynergy.com/deeplink` +
        `?id=${rakutenAffiliate}` +
        `&mid=${rakutenId}` +
        `&murl=${encodeURIComponent(url)}` +
        (sub ? `&u1=${encodeURIComponent(sub)}` : '')
      );
    }

    const skim = skimlinksId();
    if (skim) {
      return `https://go.skimresources.com/?id=${skim}&url=${encodeURIComponent(url)}` +
        (sub ? `&xcust=${encodeURIComponent(sub)}` : '');
    }

    return url;
  } catch {
    return url;
  }
}

export function wrapAll(urls: string[]): string[] {
  // Explicit arrow — don't pass map's index as wrapAffiliate's subId.
  return urls.map((url) => wrapAffiliate(url));
}
