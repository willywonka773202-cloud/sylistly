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

export function wrapAffiliate(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');

    const rakutenId = Object.entries(RAKUTEN_PARTNERS).find(([domain]) =>
      host.endsWith(domain),
    )?.[1];

    if (rakutenId && process.env.RAKUTEN_AFFILIATE_ID) {
      return (
        `https://click.linksynergy.com/deeplink` +
        `?id=${process.env.RAKUTEN_AFFILIATE_ID}` +
        `&mid=${rakutenId}` +
        `&murl=${encodeURIComponent(url)}`
      );
    }

    if (process.env.SKIMLINKS_PUBLISHER_ID) {
      return (
        `https://go.skimresources.com/?id=${process.env.SKIMLINKS_PUBLISHER_ID}` +
        `&url=${encodeURIComponent(url)}`
      );
    }

    return url;
  } catch {
    return url;
  }
}

export function wrapAll(urls: string[]): string[] {
  return urls.map(wrapAffiliate);
}
