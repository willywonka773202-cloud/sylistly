import { NextResponse } from 'next/server';
import catalogHealthData from '@/data/catalog-health.json';
import { isProductPublishable, type CatalogHealthSnapshot } from '@/lib/catalog-publishability';
import { generateEditorialLookImage, isEditorialImageConfigured } from '@/lib/editorial-image';
import { allowAiCall, clientKeyFromRequest } from '@/lib/rate-limit';
import type { Category, Product } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 40;

const CATEGORIES = new Set<Category>(['hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry']);
const PUBLISHABILITY_OPTIONS = {
  health: catalogHealthData as CatalogHealthSnapshot,
  freshnessPolicy: 'require-fresh' as const,
};

function sanitizeProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Product => Boolean(p && typeof p === 'object' && CATEGORIES.has((p as Product).category)))
    .filter((product) => isProductPublishable(product, PUBLISHABILITY_OPTIONS))
    .slice(0, 8);
}

export function GET() {
  return NextResponse.json({ configured: isEditorialImageConfigured() });
}

export async function POST(request: Request) {
  if (!isEditorialImageConfigured()) {
    return NextResponse.json({ ok: false, reason: 'not-configured', configured: false }, { status: 503 });
  }
  // Editorial gen is a paid image call — rate-limit per client so it can't be abused.
  if (!allowAiCall(clientKeyFromRequest(request)).allowed) {
    return NextResponse.json({ ok: false, reason: 'rate-limited' }, { status: 429 });
  }

  let body: { products?: unknown; vibe?: unknown; frame?: unknown; stylingNotes?: unknown; palette?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad-body' }, { status: 400 });
  }

  const products = sanitizeProducts(body.products);
  if (products.length < 2) {
    return NextResponse.json({ ok: false, reason: 'need-more-pieces' }, { status: 400 });
  }

  const frame = body.frame === 'masc' || body.frame === 'fem' || body.frame === 'androgynous' ? body.frame : undefined;
  const result = await generateEditorialLookImage({
    products,
    vibe: typeof body.vibe === 'string' ? body.vibe.slice(0, 40) : undefined,
    frame,
    stylingNotes: typeof body.stylingNotes === 'string' ? body.stylingNotes.slice(0, 280) : undefined,
    palette: Array.isArray(body.palette) ? body.palette.filter((c): c is string => typeof c === 'string').slice(0, 5) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.reason === 'not-configured' ? 503 : 502 });
  }
  return NextResponse.json(result);
}
