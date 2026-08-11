import {
  StyleFromUrlError,
  canonicalStyleUrlKey,
  categoryFromStructuredValue,
  isPrivateOrReservedAddress,
  looksLikeExactStyleProductPage,
  normalizeHttpsStyleUrl,
  normalizeStyleProductUrl,
  priceCentsFromStructuredValue,
  structuredAvailabilityIsInStock,
} from '../lib/style-from-url-policy';
import {
  STYLE_OWNED_METADATA_KEY,
  isVerifiedStyleOwnedProduct,
} from '../lib/style-owned-product';
import {
  findCatalogProductByStyleUrl,
  isAllowedStyleRetailerHost,
  styleOwnedProductFromCatalogMatch,
  verifiedStyleCatalogProduct,
} from '../lib/style-from-url';
import type { CatalogHealthSnapshot } from '../lib/catalog-publishability';
import type { Product } from '../lib/types';
import clientCatalogData from '../data/client-catalog.json';
import catalogHealthData from '../data/catalog-health.json';
import { isExactProductUrl, isOwnedCheckoutProductId } from '../lib/checkout';
import { getShoppableUrl } from '../lib/product-links';

let failures = 0;
let passes = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${label}`);
}

function errorCode(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (cause) {
    return cause instanceof StyleFromUrlError ? cause.code : 'unexpected';
  }
}

check(
  'URL normalization strips trackers and fragments',
  normalizeStyleProductUrl('https://www.kith.com/products/fixture-shirt/?utm_source=test&size=m#details')
    === 'https://www.kith.com/products/fixture-shirt?size=m',
);
check(
  'canonical key treats www and trailing slash as the same PDP',
  canonicalStyleUrlKey('https://www.kith.com/products/fixture-shirt/')
    === canonicalStyleUrlKey('https://kith.com/products/fixture-shirt'),
);
check(
  'canonical key preserves case-sensitive product paths',
  canonicalStyleUrlKey('https://kith.com/products/Fixture-Shirt')
    !== canonicalStyleUrlKey('https://kith.com/products/fixture-shirt'),
);
check('HTTP links are rejected', errorCode(() => normalizeHttpsStyleUrl('http://kith.com/products/item')) === 'invalid_url');
check('credential-bearing links are rejected', errorCode(() => normalizeHttpsStyleUrl('https://user:pass@kith.com/products/item')) === 'invalid_url');
check('nonstandard ports are rejected', errorCode(() => normalizeHttpsStyleUrl('https://kith.com:8443/products/item')) === 'invalid_url');
check('exact product-looking path passes', looksLikeExactStyleProductPage(normalizeHttpsStyleUrl('https://kith.com/products/item')));
check('collection pages are rejected', !looksLikeExactStyleProductPage(normalizeHttpsStyleUrl('https://kith.com/collections/new')));
check('search URLs are rejected', !looksLikeExactStyleProductPage(normalizeHttpsStyleUrl('https://kith.com/products?q=shirt')));
check('IPv4 loopback is private', isPrivateOrReservedAddress('127.0.0.1'));
check('IPv4 cloud metadata/link-local is private', isPrivateOrReservedAddress('169.254.169.254'));
check('RFC1918 is private', isPrivateOrReservedAddress('10.0.0.9'));
check('CGNAT is private', isPrivateOrReservedAddress('100.64.0.1'));
check('IPv6 loopback is private', isPrivateOrReservedAddress('::1'));
check('IPv4-mapped IPv6 is blocked', isPrivateOrReservedAddress('::ffff:127.0.0.1'));
check('IPv6 discard-only space is blocked', isPrivateOrReservedAddress('100::1'));
check('IPv6 6to4 space is blocked', isPrivateOrReservedAddress('2002:7f00:1::'));
check('public address is not classified private', !isPrivateOrReservedAddress('8.8.8.8'));

check('explicit shirts category normalizes to top', categoryFromStructuredValue('Apparel > Shirts') === 'top');
check('explicit footwear category normalizes to shoes', categoryFromStructuredValue('Clothing & Accessories > Footwear > Sneakers') === 'shoes');
check('ambiguous category is rejected', categoryFromStructuredValue('Shirts and Pants') === null);
check('unknown category is rejected', categoryFromStructuredValue('General merchandise') === null);
check('structured decimal USD price converts exactly to cents', priceCentsFromStructuredValue('128.00') === 12_800);
check('structured comma price converts exactly to cents', priceCentsFromStructuredValue('1,295.50') === 129_550);
check('price with an invented display symbol is rejected', priceCentsFromStructuredValue('$128.00') === null);
check('zero price is rejected', priceCentsFromStructuredValue(0) === null);
check('explicit schema InStock is accepted', structuredAvailabilityIsInStock('https://schema.org/InStock'));
check('explicit schema OutOfStock is rejected', !structuredAvailabilityIsInStock('https://schema.org/OutOfStock'));
check('missing availability is rejected', !structuredAvailabilityIsInStock(undefined));
check('checkout exact-link gate accepts a standard HTTPS PDP', isExactProductUrl('https://kith.com/products/fixture-shirt'));
check('checkout exact-link gate rejects javascript URLs', !isExactProductUrl('javascript:alert(1)'));
check('checkout exact-link gate rejects data URLs', !isExactProductUrl('data:text/html,<script>alert(1)</script>'));
check('checkout exact-link gate rejects loopback destinations', !isExactProductUrl('https://127.0.0.1/products/item'));
check('checkout identifies a transient owned anchor', isOwnedCheckoutProductId('owned-1234567890abcdef1234'));
check('checkout keeps catalog products purchasable', !isOwnedCheckoutProductId('drop-1234567890abcdef'));

const canonicalUrl = 'https://kith.com/products/fixture-shirt';
const verifiedAt = new Date().toISOString();
const ownedProduct: Product = {
  id: 'owned-1234567890abcdef1234',
  brand: 'Fixture Brand',
  name: 'Fixture Oxford Shirt',
  category: 'top',
  priceCents: 12_800,
  currency: 'USD',
  retailer: 'Kith',
  retailerUrl: canonicalUrl,
  productUrl: canonicalUrl,
  imageUrl: 'https://cdn.shopify.com/s/files/1/0000/fixture-shirt.jpg',
  imageSource: 'merchant',
  imageStatus: 'original',
  imageQuality: 'ok',
  inStock: true,
  trusted: true,
  availabilityState: 'in_stock',
  lastVerifiedAt: verifiedAt,
  metadata: {
    source: 'style_from_url',
    [STYLE_OWNED_METADATA_KEY]: {
      version: 1,
      verified: true,
      source: 'structured-product',
      canonicalUrl,
      retailerHost: 'kith.com',
      availability: 'InStock',
      imageVerified: true,
      verifiedAt,
    },
  },
};

check('server-marked owned product passes the local persistence gate', isVerifiedStyleOwnedProduct(ownedProduct));
check('owned anchors never receive a broken /api/out purchase URL', getShoppableUrl(ownedProduct) === '');
check(
  'small server/client clock skew does not discard a newly verified owned product',
  isVerifiedStyleOwnedProduct(ownedProduct, Date.parse(verifiedAt) - 2 * 60 * 1000),
);
check(
  'large future-dated verification fails the owned-product gate',
  !isVerifiedStyleOwnedProduct(ownedProduct, Date.parse(verifiedAt) - 6 * 60 * 1000),
);
check(
  'owned-product verification expires after 24 hours',
  !isVerifiedStyleOwnedProduct(ownedProduct, Date.parse(verifiedAt) + 24 * 60 * 60 * 1000 + 1),
);
check('missing explicit stock fails the owned-product gate', !isVerifiedStyleOwnedProduct({ ...ownedProduct, inStock: undefined }));
check('missing availability evidence fails the owned-product gate', !isVerifiedStyleOwnedProduct({ ...ownedProduct, availabilityState: undefined }));
check('mismatched verification timestamp fails the owned-product gate', !isVerifiedStyleOwnedProduct({ ...ownedProduct, lastVerifiedAt: new Date(Date.parse(verifiedAt) - 1).toISOString() }));
check('invalid runtime category fails the owned-product gate', !isVerifiedStyleOwnedProduct({ ...ownedProduct, category: 'unknown' as Product['category'] }));
check('unsafe or fabricated price fails the owned-product gate', !isVerifiedStyleOwnedProduct({ ...ownedProduct, priceCents: Number.MAX_SAFE_INTEGER }));
check('invalid comparison clocks fail closed', !isVerifiedStyleOwnedProduct(ownedProduct, Number.NaN));
check('non-USD imported price fails the owned-product gate', !isVerifiedStyleOwnedProduct({ ...ownedProduct, currency: 'EUR' }));
check('unverified metadata fails the owned-product gate', !isVerifiedStyleOwnedProduct({ ...ownedProduct, metadata: {} }));
check('owned-product gate requires the server flow marker', !isVerifiedStyleOwnedProduct({
  ...ownedProduct,
  metadata: { [STYLE_OWNED_METADATA_KEY]: ownedProduct.metadata?.[STYLE_OWNED_METADATA_KEY] },
}));
check('a mismatched product URL fails the owned-product gate', !isVerifiedStyleOwnedProduct({
  ...ownedProduct,
  productUrl: 'https://kith.com/products/a-different-shirt',
}));

const catalogFixture: Product = {
  ...ownedProduct,
  id: 'catalog-fixture-shirt',
  imageTransparentUrl: 'https://cdn.shopify.com/s/files/1/0000/fixture-shirt-cutout.png',
  metadata: {},
};
const catalogCheckedAt = '2026-08-10T12:00:00.000Z';
const catalogCheckedMs = Date.parse(catalogCheckedAt);
const catalogHealth: CatalogHealthSnapshot = {
  schemaVersion: 2,
  unavailable: [],
  products: {
    [catalogFixture.id]: {
      outcome: 'available',
      checkedAt: catalogCheckedAt,
      exactPdp: true,
    },
  },
};
const verifiedCatalogFixture = verifiedStyleCatalogProduct(catalogFixture, catalogHealth, catalogCheckedMs + 1);
check('fresh positive catalog evidence admits a catalog URL match', Boolean(verifiedCatalogFixture));
check('catalog match carries an explicit in-stock state', verifiedCatalogFixture?.availabilityState === 'in_stock');
check('catalog match carries the health-check timestamp', verifiedCatalogFixture?.lastVerifiedAt === catalogCheckedAt);
const ownedCatalogFixture = verifiedCatalogFixture
  ? styleOwnedProductFromCatalogMatch(verifiedCatalogFixture, canonicalUrl)
  : null;
check('strict catalog match is converted to an already-owned anchor', Boolean(ownedCatalogFixture && isVerifiedStyleOwnedProduct(ownedCatalogFixture, catalogCheckedMs + 1)));
check('catalog-owned anchor receives a stable transient ID', Boolean(
  ownedCatalogFixture
    && ownedCatalogFixture.id.startsWith('owned-')
    && ownedCatalogFixture.id === styleOwnedProductFromCatalogMatch(verifiedCatalogFixture!, canonicalUrl)?.id,
));
check('catalog-owned verification retains the source catalog ID', (
  ownedCatalogFixture?.metadata?.[STYLE_OWNED_METADATA_KEY] as { sourceCatalogProductId?: string } | undefined
)?.sourceCatalogProductId === catalogFixture.id);
check('catalog-owned anchor retains the catalog evidence timestamp', ownedCatalogFixture?.lastVerifiedAt === catalogCheckedAt);
check('catalog-owned anchor is excluded from outbound shopping', Boolean(ownedCatalogFixture && getShoppableUrl(ownedCatalogFixture) === ''));
check('catalog-owned wrapping rejects a different product URL', !styleOwnedProductFromCatalogMatch(
  verifiedCatalogFixture!,
  'https://kith.com/products/a-different-shirt',
));
check('catalog-match metadata without a source catalog ID fails closed', !isVerifiedStyleOwnedProduct({
  ...ownedProduct,
  metadata: {
    source: 'style_from_url',
    [STYLE_OWNED_METADATA_KEY]: {
      ...(ownedProduct.metadata?.[STYLE_OWNED_METADATA_KEY] as Record<string, unknown>),
      source: 'catalog-match',
    },
  },
}));
check(
  'blocked catalog evidence cannot become a Style What I Own match',
  !verifiedStyleCatalogProduct(catalogFixture, {
    ...catalogHealth,
    products: {
      [catalogFixture.id]: {
        outcome: 'blocked',
        checkedAt: catalogCheckedAt,
        exactPdp: true,
      },
    },
  }, catalogCheckedMs + 1),
);
check(
  'catalog availability expires after the 24-hour shopping SLA',
  !verifiedStyleCatalogProduct(catalogFixture, catalogHealth, catalogCheckedMs + 24 * 60 * 60 * 1000 + 1),
);
check(
  'future-dated catalog evidence cannot extend the shopping SLA',
  !verifiedStyleCatalogProduct(catalogFixture, catalogHealth, catalogCheckedMs - 6 * 60 * 1000),
);

// Exercise the real prebuilt indexes with an injected clock. This catches a
// regression where eligibility was computed only once when the module loaded.
const realHealth = catalogHealthData as CatalogHealthSnapshot;
const realIndexedFixture = (clientCatalogData as Product[]).flatMap((product) => {
  const record = realHealth.products?.[product.id];
  if (record?.outcome !== 'available' || !record.checkedAt) return [];
  const checkedMs = Date.parse(record.checkedAt);
  for (const url of [product.productUrl, product.retailerUrl]) {
    if (!url) continue;
    const match = findCatalogProductByStyleUrl(url, checkedMs + 1);
    if (match?.id === product.id) return [{ url, checkedMs }];
  }
  return [];
})[0];
if (realIndexedFixture) {
  const { url, checkedMs: realCheckedMs } = realIndexedFixture;
  check('indexed catalog matches expose fresh evidence', Number.isFinite(realCheckedMs));
  check(
    'an indexed catalog match is removed when its evidence expires',
    !findCatalogProductByStyleUrl(url, realCheckedMs + 24 * 60 * 60 * 1000 + 1),
  );
  const latestRealCheckMs = Math.max(...Object.values(realHealth.products || {}).map((record) =>
    Date.parse(record.checkedAt || ''),
  ).filter(Number.isFinite));
  check(
    'retailer host admission is reevaluated instead of frozen at module load',
    !isAllowedStyleRetailerHost(new URL(url).hostname, latestRealCheckMs + 24 * 60 * 60 * 1000 + 1),
  );
} else {
  check('current catalog fixture exists for dynamic-index checks', false);
}

console.log(`\nStyle-from-URL checks: ${passes} passed, ${failures} failed`);
if (failures) process.exitCode = 1;
