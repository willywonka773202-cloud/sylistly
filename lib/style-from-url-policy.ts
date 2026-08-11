import { isIP } from 'node:net';
import { CATEGORY_ORDER, type Category } from './types';

export const STYLE_FROM_URL_MAX_URL_LENGTH = 2_048;

const TRACKING_QUERY_KEYS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  'source',
  'srsltid',
]);

export type StyleFromUrlErrorCode =
  | 'invalid_url'
  | 'retailer_not_supported'
  | 'unsafe_destination'
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'response_too_large'
  | 'unsupported_response'
  | 'structured_product_missing'
  | 'exact_url_unverified'
  | 'name_unverified'
  | 'brand_unverified'
  | 'category_unverified'
  | 'price_unverified'
  | 'currency_unsupported'
  | 'availability_unverified'
  | 'image_unverified';

export class StyleFromUrlError extends Error {
  constructor(
    public readonly code: StyleFromUrlErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StyleFromUrlError';
  }
}

export function styleFromUrlError(code: StyleFromUrlErrorCode, status: number, message: string): never {
  throw new StyleFromUrlError(code, status, message);
}

export function normalizeRetailerHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

export function normalizeHttpsStyleUrl(input: string | URL, base?: URL): URL {
  const source = input.toString();
  if (!source.trim() || source.length > STYLE_FROM_URL_MAX_URL_LENGTH) {
    return styleFromUrlError('invalid_url', 400, 'Paste a complete HTTPS product URL.');
  }
  let parsed: URL;
  try {
    parsed = base ? new URL(source.trim(), base) : new URL(source.trim());
  } catch {
    return styleFromUrlError('invalid_url', 400, 'Paste a complete HTTPS product URL.');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || (parsed.port && parsed.port !== '443')
  ) {
    return styleFromUrlError('invalid_url', 400, 'Only standard HTTPS retailer links are supported.');
  }
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed;
}

export function normalizeStyleProductUrl(input: string): string {
  return normalizeHttpsStyleUrl(input).toString();
}

export function canonicalStyleUrlKey(input: string): string {
  const parsed = normalizeHttpsStyleUrl(input);
  return `${normalizeRetailerHost(parsed.hostname)}${parsed.pathname || '/'}${parsed.search}`;
}

export function sameStyleProductPath(left: URL, right: URL): boolean {
  return normalizeRetailerHost(left.hostname) === normalizeRetailerHost(right.hostname)
    && left.pathname.replace(/\/+$/, '') === right.pathname.replace(/\/+$/, '');
}

export function looksLikeExactStyleProductPage(url: URL): boolean {
  const hostname = normalizeRetailerHost(url.hostname);
  const pathname = url.pathname.toLowerCase();
  if (!pathname || pathname === '/') return false;
  if (hostname.startsWith('google.') || hostname.includes('.google.')) return false;
  if (/\/(search|collections?|category|categories|new|sale)(\/|$)/.test(pathname)) return false;
  if (url.searchParams.has('q') || url.searchParams.has('query') || url.searchParams.has('search')) return false;
  return true;
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((part) => part >= 0 && part <= 255) ? octets : null;
}

/** Reject non-public address space, including loopback, link-local, RFC1918,
 * CGNAT, benchmark, documentation, multicast, and IPv4-mapped IPv6. */
export function isPrivateOrReservedAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  const v4 = parseIpv4(normalized);
  if (v4) {
    const [a, b, c] = v4;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 192 && b === 88 && c === 99) return true;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    return false;
  }
  if (isIP(normalized) !== 6) return true;
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('::ffff:')
    || normalized.startsWith('64:ff9b:')
    || normalized === '100::'
    || normalized.startsWith('100::')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || /^fe[c-f]/.test(normalized)
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8:')
    || normalized.startsWith('2001:10:')
    || normalized.startsWith('2001:20:')
    || normalized.startsWith('2002:');
}

const CATEGORY_TERMS: Record<Category, string[]> = {
  hat: ['hat', 'hats', 'cap', 'caps', 'beanie', 'beanies', 'headwear', 'headband'],
  outer: ['outerwear', 'jacket', 'jackets', 'coat', 'coats', 'blazer', 'blazers', 'trench', 'puffer', 'vest', 'vests'],
  top: ['top', 'tops', 'shirt', 'shirts', 'tee', 'tees', 't shirt', 't shirts', 'blouse', 'blouses', 'sweater', 'sweaters', 'hoodie', 'hoodies', 'cardigan', 'cardigans', 'tank', 'tanks', 'polo', 'polos'],
  bottom: ['bottom', 'bottoms', 'pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'skirts', 'legging', 'leggings', 'jogger', 'joggers'],
  shoes: ['shoe', 'shoes', 'footwear', 'sneaker', 'sneakers', 'trainer', 'trainers', 'boot', 'boots', 'loafer', 'loafers', 'heel', 'heels', 'sandal', 'sandals', 'clog', 'clogs', 'flat', 'flats'],
  bag: ['bag', 'bags', 'handbag', 'handbags', 'tote', 'totes', 'backpack', 'backpacks', 'purse', 'purses', 'crossbody', 'clutch'],
  eyewear: ['eyewear', 'sunglasses', 'glasses', 'eyeglasses', 'frames'],
  jewelry: ['jewelry', 'jewellery', 'necklace', 'necklaces', 'bracelet', 'bracelets', 'ring', 'rings', 'earring', 'earrings', 'bangle', 'bangles', 'watch', 'watches'],
};

function normalizeWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function categoryFromStructuredValue(value: string): Category | null {
  const normalized = ` ${normalizeWords(value)} `;
  const matches = CATEGORY_ORDER.filter((category) =>
    CATEGORY_TERMS[category].some((term) => normalized.includes(` ${normalizeWords(term)} `)),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function priceCentsFromStructuredValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const source = String(value).trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(source)) return null;
  const price = Number(source.replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0 || price > 100_000) return null;
  return Math.round(price * 100);
}

export function structuredAvailabilityIsInStock(value: unknown): boolean {
  const text = typeof value === 'string'
    ? value.trim()
    : value && typeof value === 'object' && !Array.isArray(value)
      ? ['name', 'value', '@id'].map((key) => (value as Record<string, unknown>)[key]).find((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))?.trim()
      : null;
  return Boolean(text && text.split(/[\/#]/).pop()?.toLowerCase() === 'instock');
}
