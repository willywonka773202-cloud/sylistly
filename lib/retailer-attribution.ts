import { ensureAnalyticsIdentity } from './analytics-identity';

const SAFE_TOKEN = /^[a-zA-Z0-9_.:-]+$/;
const BLOCKED_HOSTS = new Set([
  'click.linksynergy.com',
  'go.skimresources.com',
  'google.com',
  'www.google.com',
  'localhost',
]);

export interface RetailerAttribution {
  productId: string;
  lookId?: string;
  surface?: string;
  campaign?: string;
  subId?: string;
  anonymousId?: string;
  sessionId?: string;
}

export interface DestinationValidation {
  ok: boolean;
  url?: string;
  host?: string;
  error?: 'invalid_url' | 'unsafe_protocol' | 'unsafe_host' | 'unsafe_credentials' | 'unsafe_port';
}

export function sanitizeAttributionToken(value: unknown, maxLength = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || !SAFE_TOKEN.test(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeAnalyticsIdentity(value: unknown, prefix: 'a' | 's'): string | undefined {
  const safe = sanitizeAttributionToken(value, 72);
  return safe && new RegExp(`^${prefix}_[a-zA-Z0-9]{8,64}$`).test(safe) ? safe : undefined;
}

function compactAttributionToken(value: unknown, inputMax: number, outputMax: number): string {
  const safe = sanitizeAttributionToken(value, inputMax) || 'unknown';
  if (safe.length <= outputMax) return safe;
  const tailLength = Math.min(24, outputMax - 2);
  return `${safe.slice(0, outputMax - tailLength - 1)}_${safe.slice(-tailLength)}`;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return true;
  return octets[0] === 10
    || octets[0] === 127
    || octets[0] === 0
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

export function validateRetailerDestination(value: string): DestinationValidation {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    if (parsed.protocol !== 'https:') return { ok: false, error: 'unsafe_protocol' };
    if (parsed.username || parsed.password) return { ok: false, error: 'unsafe_credentials' };
    if (parsed.port && parsed.port !== '443') return { ok: false, error: 'unsafe_port' };
    if (
      !host
      || host.includes(':')
      || host.endsWith('.local')
      || host.endsWith('.localhost')
      || BLOCKED_HOSTS.has(host)
      || isPrivateIpv4(host)
    ) {
      return { ok: false, error: 'unsafe_host' };
    }
    parsed.hash = '';
    return { ok: true, url: parsed.toString(), host };
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
}

export function buildAffiliateSubId(attribution: RetailerAttribution): string {
  const parts = [
    `p.${compactAttributionToken(attribution.productId, 180, 72)}`,
    attribution.lookId ? `l.${compactAttributionToken(attribution.lookId, 120, 36)}` : '',
    attribution.surface ? `s.${compactAttributionToken(attribution.surface, 80, 28)}` : '',
    attribution.campaign ? `c.${compactAttributionToken(attribution.campaign, 80, 28)}` : '',
    attribution.subId ? `x.${compactAttributionToken(attribution.subId, 180, 48)}` : '',
  ].filter(Boolean);
  return parts.join('|').slice(0, 240);
}

export function buildRetailerClickPath(input: RetailerAttribution): string {
  const identity = ensureAnalyticsIdentity();
  const params = new URLSearchParams();
  params.set('product', input.productId);
  if (input.lookId) params.set('look', input.lookId);
  if (input.surface) params.set('surface', input.surface);
  if (input.campaign) params.set('campaign', input.campaign);
  if (input.subId) params.set('sub', input.subId);
  if (input.anonymousId || identity?.anonymousId) params.set('aid', input.anonymousId || identity!.anonymousId);
  if (input.sessionId || identity?.sessionId) params.set('sid', input.sessionId || identity!.sessionId);
  return `/api/out?${params.toString()}`;
}

export function affiliateNetworkForUrl(url: string, rawDestination: string): 'rakuten' | 'skimlinks' | 'direct' {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'click.linksynergy.com') return 'rakuten';
    if (host === 'go.skimresources.com') return 'skimlinks';
  } catch {
    // A validated raw destination is used when affiliate wrapping is disabled.
  }
  return url === rawDestination ? 'direct' : 'direct';
}
