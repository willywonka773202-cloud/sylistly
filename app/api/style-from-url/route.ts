import { NextRequest, NextResponse } from 'next/server';
import {
  STYLE_FROM_URL_LIMITS,
  StyleFromUrlError,
  resolveStyleFromUrl,
} from '@/lib/style-from-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 8;
const MAX_TRACKED_CLIENTS = 1_000;
const OVERFLOW_CLIENT_KEY = 'client:overflow';
const attemptsByClient = new Map<string, number[]>();

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const raw = forwarded || request.headers.get('x-real-ip')?.trim() || 'anonymous';
  // Proxy headers are untrusted input. Bound key size so a forged header cannot
  // turn the in-memory best-effort limiter into an allocation primitive.
  return `client:${raw.slice(0, 96)}`;
}

function consumeRateLimit(request: NextRequest): boolean {
  const now = Date.now();
  let key = clientKey(request);
  // Reserve one bounded overflow bucket. New/spoofed identities fail closed
  // together once the per-instance table is full instead of growing the map.
  if (!attemptsByClient.has(key) && attemptsByClient.size >= MAX_TRACKED_CLIENTS - 1) {
    for (const [candidate, timestamps] of attemptsByClient) {
      if (!timestamps.some((timestamp) => now - timestamp < RATE_WINDOW_MS)) attemptsByClient.delete(candidate);
    }
  }
  if (!attemptsByClient.has(key) && attemptsByClient.size >= MAX_TRACKED_CLIENTS - 1) {
    key = OVERFLOW_CLIENT_KEY;
  }
  const recent = (attemptsByClient.get(key) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    attemptsByClient.set(key, recent);
    return false;
  }
  recent.push(now);
  attemptsByClient.set(key, recent);
  return true;
}

async function readLimitedJson(request: NextRequest): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new StyleFromUrlError('invalid_url', 413, 'The request is too large.');
  }
  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let source = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new StyleFromUrlError('invalid_url', 413, 'The request is too large.');
    }
    source += decoder.decode(value, { stream: true });
  }
  source += decoder.decode();
  try {
    const parsed = JSON.parse(source || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    throw new StyleFromUrlError('invalid_url', 400, 'Send a valid JSON body with a product URL.');
  }
}

export async function POST(request: NextRequest) {
  if (!consumeRateLimit(request)) {
    return json({
      ok: false,
      code: 'rate_limited',
      error: 'Too many retailer checks. Wait a minute and try again.',
    }, 429);
  }

  try {
    const body = await readLimitedJson(request);
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url || url.length > STYLE_FROM_URL_LIMITS.maxUrlLength) {
      throw new StyleFromUrlError('invalid_url', 400, 'Paste a complete HTTPS product URL.');
    }
    const result = await resolveStyleFromUrl(url);
    return json({
      ok: true,
      source: result.source,
      canonicalUrl: result.canonicalUrl,
      product: result.product,
      verification: result.source === 'catalog'
        ? { exactCatalogMatch: true }
        : {
            exactCatalogMatch: false,
            structuredProduct: true,
            explicitAvailability: true,
            imageVerified: true,
          },
    });
  } catch (cause) {
    if (cause instanceof StyleFromUrlError) {
      return json({ ok: false, code: cause.code, error: cause.message }, cause.status);
    }
    return json({
      ok: false,
      code: 'upstream_unavailable',
      error: 'The product could not be verified right now. Try again later.',
    }, 502);
  }
}
