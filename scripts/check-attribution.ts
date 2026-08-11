import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { join } from 'node:path';
import clientCatalogData from '../data/client-catalog.json';
import {
  analyticsEventContractIssues,
  analyticsEventProperties,
  buildAnalyticsLookId,
  isCanonicalAnalyticsEvent,
  normalizeAnalyticsEvent,
} from '../lib/analytics-events';
import { getShoppableUrl } from '../lib/product-links';
import { resolveProductById } from '../lib/product-resolution';
import {
  affiliateNetworkForUrl,
  buildAffiliateSubId,
  buildRetailerClickPath,
  sanitizeAnalyticsIdentity,
  sanitizeAttributionToken,
  validateRetailerDestination,
} from '../lib/retailer-attribution';
import type { Product } from '../lib/types';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry: Dirent) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

async function main(): Promise<void> {
  const legacy = normalizeAnalyticsEvent('shop_link_clicked');
  check('legacy shop event maps to canonical retailer click', legacy.event === 'retailer_click_started');
  check('legacy name remains queryable as a property', legacy.legacyEvent === 'shop_link_clicked');
  check('canonical event remains unchanged', normalizeAnalyticsEvent('look_impression').event === 'look_impression');
  const normalizedProperties = analyticsEventProperties(
    { event: 'look_impression' },
    {
      lookId: 'look_123',
      pieces: 3,
      totalCents: 24_500,
      source: 'test',
      budget: 'mid',
      vibe: 'clean',
      fullyBuyable: true,
      surface: 'test',
    },
  );
  check('camel-case call sites receive canonical look_id', normalizedProperties.look_id === 'look_123');
  check('camel-case call sites receive canonical fully_buyable', normalizedProperties.fully_buyable === true);
  check('compatibility keys are removed after canonicalization', normalizedProperties.lookId === undefined && normalizedProperties.fullyBuyable === undefined);
  check('valid funnel event satisfies property contract', normalizedProperties.event_contract_issues === undefined);
  check('missing KPI entity is observable, not thrown', analyticsEventContractIssues('look_saved', { surface: 'feed' }).includes('missing:look_id'));
  check('unknown event names are marked non-canonical', analyticsEventContractIssues('made_up_event', {}).includes('event:not_canonical'));

  const lookIdA = buildAnalyticsLookId('Discover Clean', ['product-2', 'product-1', 'product-1']);
  const lookIdB = buildAnalyticsLookId('Discover Clean', ['product-1', 'product-2']);
  check('derived look IDs are stable across product ordering', lookIdA === lookIdB);
  check('derived look IDs are bounded attribution-safe tokens', lookIdA.length < 80 && /^[a-z0-9_-]+$/.test(lookIdA));

  const literalTrackEvents = ['app', 'components', 'lib', 'store']
    .flatMap((directory) => sourceFiles(directory))
    .flatMap((path) => Array.from(
      readFileSync(path, 'utf8').matchAll(/\btrack\(\s*['"]([^'"]+)['"]/g),
      (match) => ({ path, event: match[1] }),
    ));
  const nonCanonicalLiterals = literalTrackEvents.filter(({ event }) =>
    !isCanonicalAnalyticsEvent(normalizeAnalyticsEvent(event).event));
  if (nonCanonicalLiterals.length) {
    console.error('Non-canonical track literals:', nonCanonicalLiterals);
  }
  check('every literal track call normalizes to the canonical taxonomy', nonCanonicalLiterals.length === 0);

  const analyticsSource = readFileSync('lib/analytics.ts', 'utf8');
  check('analytics disables automatic interaction capture', analyticsSource.includes('autocapture: false'));
  check('analytics disables session replay and heatmaps', analyticsSource.includes('disable_session_recording: true') && analyticsSource.includes('capture_heatmaps: false'));
  check('data reset defers new identity creation', analyticsSource.includes('deferIdentityRegistrationUntilCapture = true'));

  const valid = validateRetailerDestination('https://www.nike.com/t/air-force-1?color=white#details');
  check('valid HTTPS retailer destination accepted', valid.ok && valid.host === 'www.nike.com');
  check('retailer fragment stripped before redirect', valid.url === 'https://www.nike.com/t/air-force-1?color=white');
  check('HTTP destination rejected', validateRetailerDestination('http://nike.com/t/shoe').error === 'unsafe_protocol');
  check('private IPv4 destination rejected', validateRetailerDestination('https://192.168.1.4/p/1').error === 'unsafe_host');
  check('localhost destination rejected', validateRetailerDestination('https://localhost/p/1').error === 'unsafe_host');
  check('credential-bearing destination rejected', validateRetailerDestination('https://user:pass@nike.com/p/1').error === 'unsafe_credentials');
  check('affiliate wrapper cannot be used as raw destination', validateRetailerDestination('https://go.skimresources.com/?url=x').error === 'unsafe_host');

  const attribution = {
    productId: 'prod_123',
    lookId: 'look_456',
    surface: 'checkout-sheet',
    campaign: 'daily-drop',
    subId: 'prod_123',
  };
  const subId = buildAffiliateSubId(attribution);
  check('network sub-id preserves product attribution', subId.includes('p.prod_123'));
  check('network sub-id preserves look/surface/campaign attribution', subId.includes('l.look_456') && subId.includes('s.checkout-sheet') && subId.includes('c.daily-drop'));
  check('unsafe attribution tokens rejected', sanitizeAttributionToken('../secret') === undefined);
  check('anonymous identity requires opaque a_ prefix', sanitizeAnalyticsIdentity('user@example.com', 'a') === undefined);
  check('valid opaque anonymous identity accepted', sanitizeAnalyticsIdentity('a_12345678abcdef', 'a') === 'a_12345678abcdef');

  const route = buildRetailerClickPath(attribution);
  check('click path is first-party server redirect', route.startsWith('/api/out?'));
  const routeUrl = new URL(route, 'https://www.sylistly.com');
  check('click path preserves per-product sub-id', routeUrl.searchParams.get('sub') === 'prod_123');

  const firstProduct = (clientCatalogData as unknown as Product[])[0];
  check('static catalog fixture exists', Boolean(firstProduct?.id));
  const resolved = firstProduct ? await resolveProductById(firstProduct.id) : null;
  check('static product resolves without Supabase', resolved?.source === 'static' && resolved.product.id === firstProduct.id);
  const shoppable = firstProduct ? getShoppableUrl(firstProduct, { surface: 'test', subId: firstProduct.id }) : '';
  check('product links use attributed redirect', shoppable.startsWith('/api/out?') && shoppable.includes(`product=${encodeURIComponent(firstProduct.id)}`));
  const longIdProduct = (clientCatalogData as unknown as Product[]).find((product) => product.id.length > 96);
  const longIdRoute = longIdProduct ? getShoppableUrl(longIdProduct, { surface: 'test' }) : '';
  check('long static product ids survive redirect attribution', Boolean(
    longIdProduct
    && new URL(longIdRoute, 'https://www.sylistly.com').searchParams.get('product') === longIdProduct.id,
  ));
  check('affiliate network detection: direct', affiliateNetworkForUrl('https://nike.com/p/1', 'https://nike.com/p/1') === 'direct');
  check('affiliate network detection: Skimlinks', affiliateNetworkForUrl('https://go.skimresources.com/?id=1', 'https://nike.com/p/1') === 'skimlinks');
  check('affiliate network detection: Rakuten', affiliateNetworkForUrl('https://click.linksynergy.com/deeplink?id=1', 'https://nike.com/p/1') === 'rakuten');

  console.log(`\nAttribution checks: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

void main();
